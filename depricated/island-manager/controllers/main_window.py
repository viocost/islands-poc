import logging
import webbrowser
import sys
from threading import Thread
from time import sleep

from PyQt5.QtCore import pyqtSignal, QEvent
from PyQt5.QtGui import QIcon, QPixmap, QMovie
from PyQt5.QtWidgets import QMainWindow, QMessageBox as QM, QMenu, QSystemTrayIcon, QAction

from controllers.config_form import ConfigForm
from controllers.help_form import Helpform
from controllers.image_authoring_form import ImageAuthoringForm
from controllers.keys_form import KeysForm
from controllers.logs_form import LogsForm
from controllers.setup_wizard_window import SetupWizardWindow as SetupWindow
from controllers.torrents_form import TorrentsForm
from controllers.update_form import UpdateForm
from lib.island_states import IslandStates as States
from lib.key_manager import KeyManager
from lib.util import get_version, is_admin_registered, adjust_window_size
from views.main_form.main_form import Ui_MainWindow

log = logging.getLogger(__name__)


class MainWindow(QMainWindow):
    tray_icon = None
    note_expire = pyqtSignal()
    current_state_signal = pyqtSignal(object)
    processing = pyqtSignal()
    state_changed = pyqtSignal()
    focus_in = pyqtSignal()
    access_links_result = pyqtSignal(bool, str)

    def __init__(self, config, island_manager, setup, torrent_manager):
        super(MainWindow, self).__init__()
        icon = QIcon()
        icon.addPixmap(QPixmap(":/images/icons/island128.png"))
        self.tray_menu = QMenu()
        self.menu_actions = self.prepare_tray_menu(self.tray_menu)
        self.tray_icon = QSystemTrayIcon(self)
        self.tray_icon.setContextMenu(self.tray_menu)
        self.tray_icon.setIcon(icon)
        self.tray_icon.activated.connect(self.process_tray_icon_activation)
        self.tray_icon.show()
        self.exiting = False
        self.config = config
        self.setup = setup
        self.island_manager = island_manager
        self.states = self.prepare_states()
        self.current_state = States.UNKNOWN
        self.ui = Ui_MainWindow()
        self.ui.setupUi(self)
        self.key_manager = KeyManager(self.config)
        self.assign_handlers()
        self.setup_window = None
        self.torrent_manager = torrent_manager
        self.set_state(States.UNKNOWN)
        self.refresh_island_status()
        self.set_main_window_title()
        # island status refresh counter
        self.local_access = None
        self.admin_access = None
        self.refresh_count = 0
        log.debug("Main window controller initialized.")
        self.launch_background_links_updater()
        self.pending_state = False
        adjust_window_size(self)


    def event(self, event):
        if event.type() == QEvent.ActivationChange:
            log.debug("Focus In detected")
            self.refresh_island_status()
            return True

        if event.type() == QEvent.Close:
            log.debug("Close event caught!")
            self.process_close(event)
            return True

        return super().event(event)

    def process_close(self, event):
        if not self.exiting:
            event.ignore()
            self.showMinimized()

    def refresh_island_status(self):
        if self.pending_state:
            log.debug("pending state...")
            return
        try:
            if self.setup.is_setup_required():
                self.set_state(States.SETUP_REQUIRED)
            else:
                self.island_manager.emit_islands_current_state(self.state_emitter)
        except Exception as e:
            log.error("Error refreshing island statuus: %s" % str(e))
            self.set_state(States.UNKNOWN)

    def prepare_states(self):
        return {
            States.SETUP_REQUIRED: self.set_setup_required,
            States.RUNNING: self.set_running,
            States.NOT_RUNNING: self.set_not_running,
            States.STARTING_UP: self.set_starting_up,
            States.SHUTTING_DOWN: self.set_shutting_down,
            States.RESTARTING: self.set_restarting,
            States.UNKNOWN: self.set_unknown
        }

    def request_to_run_setup(self):
        message = "Islands setup is required. Would you like to launch it now?"
        res = QM.question(self, '', message, QM.Yes | QM.No)
        if res == QM.Yes:
            self.launch_setup()

    # Connects UI element with handler
    def assign_handlers(self):
        """
        Assigns handlers for all UI elements events
        :return:
        """
        self.ui.launchIslandButton.clicked.connect(self.get_main_control_handler("launch"))
        self.ui.shutdownIslandButton.clicked.connect(self.get_main_control_handler("stop"))
        self.ui.restartIslandButton.clicked.connect(self.get_main_control_handler("restart"))
        self.ui.button_launch_setup.clicked.connect(self.launch_setup)
        self.current_state_signal.connect(self.set_state)
        self.ui.actionInfo.triggered.connect(self.show_app_info)
        self.ui.actionClose.triggered.connect(self.quit_app)
        self.ui.actionMinimize_2.triggered.connect(self.minimize_main_window)
        self.processing.connect(self.set_working)
        self.state_changed.connect(self.refresh_island_status)
        self.ui.act_islandsimage_authoring.triggered.connect(self.author_image)
        self.ui.act_my_torrents.triggered.connect(self.show_my_torrents)
        self.ui.act_trusted_keys.triggered.connect(lambda: self.open_keys_form())
        self.ui.act_view_logs.triggered.connect(self.open_logs_form)
        self.ui.act_my_keys.triggered.connect(lambda: self.open_keys_form(True))
        self.ui.act_open_config.triggered.connect(lambda: self.open_config())
        self.ui.act_update_vm.triggered.connect(self.open_update)
        self.ui.act_help.triggered.connect(self.open_user_guide)
        self.access_links_result.connect(self.set_links_on_signal)
        self.ui.btn_go_to_island.clicked.connect(self.open_island_link)
        self.ui.btn_admin.clicked.connect(lambda: self.open_island_link(admin=True))
        self.note_expire.connect(self.hide_note)

        self.ui.btn_close_hint.clicked.connect(self.hide_note)

    def open_user_guide(self):
        help_form = Helpform(self)
        help_form.exec()

    def open_logs_form(self):
        logs_form = LogsForm(self, self.config["manager_data_folder"])
        logs_form.exec()

    def author_image(self):
        log.debug("Opening image authoring form")
        form = ImageAuthoringForm(parent=self,
                                  key_manager=self.key_manager,
                                  config=self.config,
                                  torrent_manager=self.torrent_manager)
        form.exec()
        log.debug("Image authoring form closed")

    def state_emitter(self, state):
        """
        Given a state emits it to PYQT so it could update all UI elements accordingly.
        :param state:
        :return:
        """
        self.current_state_signal.emit(state)

    def get_main_control_handler(self, cmd):
        cmds = {
            "launch": "launch_island",
            "stop": "stop_island",
            "restart": "restart_island",
        }
        params = {
            "Quiet": "",
            "Normal": ", False",
            "Soft": "",
            "Force": ", True"
        }

        def get_param(cmd):
            if cmd == "launch" or cmd == "restart":
                return params[self.ui.launchMode.currentText()]
            elif cmd == "stop":
                return params[self.ui.stopMode.currentText()]

        if cmd not in cmds:
            raise KeyError

        def handler():
            self.set_working()
            try:
                param = get_param(cmd)
                command = ("self.island_manager.{cmd}(self.state_emitter{param})".format(
                    cmd=cmds[cmd],
                    param=param if param else ""))
                res = eval(command)
            except Exception as e:
                print("Error occured")
                print(e)

        return handler

    def open_config(self):
        self.activateWindow()
        log.debug("Opening")
        config = ConfigForm(self, self.config, self.setup, self.island_manager)
        config.exec()
        self.refresh_island_status()
        self.state_changed.emit()

    def open_update(self):
        log.debug("opening update form")
        update_form = UpdateForm(self, self.config, self.island_manager, self.setup)
        update_form.exec()
        sleep(1)
        self.state_changed.emit()

    def launch_setup(self):
        self.setup_window = SetupWindow(self, self.config, self.island_manager, self.setup)
        self.set_setup_window_onclose_handler(self.setup_window)
        self.setup_window.set_vbox_checker(self.setup.is_vbox_set_up)
        self.setup_window.set_islands_vm_checker(self.setup.is_islands_vm_exist)
        res = self.setup_window.exec()
        print("WIZARD RESULT IS {res}".format(res=res))
        self.refresh_island_status()

    def open_keys_form(self, is_private_keys=False):
        keys_form = KeysForm(self, self.key_manager, self.config, is_private_keys)
        keys_form.exec()

    def show_my_torrents(self):
        self.activateWindow()
        torrents_dialog = TorrentsForm(self, self.torrent_manager, self.config)
        torrents_dialog.exec()

    def set_setup_window_onclose_handler(self, window):
        def handler():
            self.refresh_island_status()

        window.on_close(handler)

    def set_state(self, state):
        if state not in self.states:
            raise KeyError("Invalid main window state.")
        try:
            self.states[state]()
        except Exception as e:
            log.error("Error setting state %s: %s" % (state, str(e)))

    """MENU HANDLERS"""

    def minimize_main_window(self):
        self.showMinimized()

    def show_app_info(self):
        self.show()
        QM.about(self, "", "Islands Virtual Machine Manager\nVersion: %s" % get_version())

    def on_close(self):
        self.close()

    def set_main_window_title(self):
        self.setWindowTitle("Islands Manager %s" % "v" + get_version())

    """ STATE SETTERS """
    def toggle_loading_animation(self, activate):
        self.loading_animation  = QMovie("resources/icons/loading.gif")
        self.ui.lbl_loading.setMovie(self.loading_animation)
        self.loading_animation.start()
        log.debug("Toggling loading animation")
        self.ui.lbl_loading.setVisible(activate)
        if sys.platform == "darwin":
            self.repaint()

    def set_setup_required(self):
        self.current_state = States.SETUP_REQUIRED
        self.pending_state = False
        self.menu_actions["start"].setEnabled(False)
        self.menu_actions["stop"].setEnabled(False)
        self.menu_actions["restart"].setEnabled(False)
        self.ui.btn_go_to_island.setVisible(False)
        self.ui.btn_admin.setVisible(False)
        reason = self.setup.is_setup_required()
        self.ui.islandStatus.setText("Setup required")
        self.ui.islandStatus.setStyleSheet('color: orange')
        self.ui.restartIslandButton.setEnabled(False)
        self.ui.shutdownIslandButton.setEnabled(False)
        self.ui.launchIslandButton.setEnabled(False)
        self.ui.groupBox.setEnabled(True)
        self.ui.setup_required_reason.setText(reason)
        self.ui.groupBox.show()
        self.ui.launchMode.setEnabled(False)
        self.ui.stopMode.setEnabled(False)
        self.toggle_loading_animation(False)
        if sys.platform == "darwin":
            self.repaint()

    def set_running(self):
        self.current_state = States.RUNNING
        self.toggle_loading_animation(False)
        self.pending_state = False
        self.menu_actions["start"].setEnabled(False)
        self.menu_actions["stop"].setEnabled(True)
        self.menu_actions["restart"].setEnabled(True)
        self.load_access_links()
        self.ui.islandStatus.setText("Running")
        self.ui.islandStatus.setStyleSheet('color: green')
        self.ui.restartIslandButton.setEnabled(True)
        self.ui.shutdownIslandButton.setEnabled(True)
        self.ui.launchIslandButton.setEnabled(False)
        self.ui.groupBox.setEnabled(False)
        self.ui.groupBox.hide()
        self.ui.launchMode.setEnabled(False)
        self.ui.stopMode.setEnabled(True)
        if sys.platform == "darwin":
            self.repaint()

    def set_starting_up(self):
        self.current_state = States.STARTING_UP
        self.ui.btn_go_to_island.setVisible(False)
        self.toggle_loading_animation(True)
        self.ui.btn_admin.setVisible(False)
        self.pending_state = True
        self.menu_actions["start"].setEnabled(False)
        self.menu_actions["stop"].setEnabled(False)
        self.menu_actions["restart"].setEnabled(False)
        self.ui.islandStatus.setText("Starting up...")
        self.ui.islandStatus.setStyleSheet('color: blue')
        self.ui.restartIslandButton.setEnabled(False)
        self.ui.shutdownIslandButton.setEnabled(False)
        self.ui.launchIslandButton.setEnabled(False)
        self.ui.groupBox.setEnabled(False)
        self.ui.groupBox.hide()
        self.ui.launchMode.setEnabled(False)
        self.ui.stopMode.setEnabled(False)
        if sys.platform == "darwin":
            self.repaint()

    def set_shutting_down(self):
        self.current_state = States.SHUTTING_DOWN
        self.ui.btn_go_to_island.setVisible(False)
        self.ui.btn_admin.setVisible(False)
        self.pending_state = True
        self.menu_actions["start"].setEnabled(False)
        self.menu_actions["stop"].setEnabled(False)
        self.menu_actions["restart"].setEnabled(False)
        self.ui.islandStatus.setText("Shutting down...")
        self.ui.islandStatus.setStyleSheet('color: orange')
        self.ui.groupBox.setEnabled(False)
        self.ui.groupBox.hide()
        self.set_working()
        if sys.platform == "darwin":
            self.repaint()

    def set_not_running(self):
        self.ui.btn_go_to_island.setVisible(False)
        self.ui.btn_admin.setVisible(False)
        self.toggle_loading_animation(False)
        self.current_state = States.NOT_RUNNING
        self.pending_state = False
        self.menu_actions["start"].setEnabled(True)
        self.menu_actions["stop"].setEnabled(False)
        self.menu_actions["restart"].setEnabled(False)
        self.ui.islandStatus.setText("Not running")
        self.ui.islandStatus.setStyleSheet('color: red')
        self.ui.restartIslandButton.setEnabled(False)
        self.ui.shutdownIslandButton.setEnabled(False)
        self.ui.launchIslandButton.setEnabled(True)
        self.ui.groupBox.setEnabled(False)
        self.ui.groupBox.hide()
        self.ui.launchMode.setEnabled(True)
        self.ui.stopMode.setEnabled(False)
        if sys.platform == "darwin":
            self.repaint()

    def set_unknown(self):
        self.ui.btn_go_to_island.setVisible(False)
        self.ui.btn_admin.setVisible(False)
        self.current_state = States.UNKNOWN
        self.toggle_loading_animation(False)
        self.pending_state = False
        self.menu_actions["start"].setEnabled(False)
        self.menu_actions["stop"].setEnabled(False)
        self.menu_actions["restart"].setEnabled(False)
        self.ui.islandStatus.setText("Unknown")
        self.ui.islandStatus.setStyleSheet('color: gray')
        self.ui.restartIslandButton.setEnabled(False)
        self.ui.shutdownIslandButton.setEnabled(False)
        self.ui.launchIslandButton.setEnabled(False)
        self.ui.groupBox.setEnabled(False)
        self.ui.groupBox.hide()
        self.ui.launchMode.setEnabled(False)
        self.ui.stopMode.setEnabled(False)
        if sys.platform == "darwin":
            self.repaint()

    def set_restarting(self):
        self.ui.btn_go_to_island.setVisible(False)
        self.ui.btn_admin.setVisible(False)
        self.current_state = States.RESTARTING
        self.pending_state = True
        self.toggle_loading_animation(True)
        self.menu_actions["start"].setEnabled(False)
        self.menu_actions["stop"].setEnabled(False)
        self.menu_actions["restart"].setEnabled(False)
        self.ui.islandStatus.setText("Restarting...")
        self.ui.islandStatus.setStyleSheet('color: blue')
        self.set_working()
        if sys.platform == "darwin":
            self.repaint()

    def set_working(self):
        self.pending_state = True
        self.toggle_loading_animation(True)
        self.menu_actions["start"].setEnabled(False)
        self.menu_actions["stop"].setEnabled(False)
        self.menu_actions["restart"].setEnabled(False)
        self.ui.restartIslandButton.setEnabled(False)
        self.ui.shutdownIslandButton.setEnabled(False)
        self.ui.launchIslandButton.setEnabled(False)
        self.ui.launchMode.setEnabled(False)
        self.ui.stopMode.setEnabled(False)
        if sys.platform == "darwin":
            self.repaint()

    # HELPERS
    def hide_note(self):
        self.ui.grp_note_container.setVisible(False)
        if sys.platform == "darwin":
            self.repaint()

    def show_note(self, msg, lifespan=20):
        self.ui.lbl_hint.setText(msg)
        self.ui.grp_note_container.setVisible(True)
        if sys.platform == "darwin":
            self.repaint()
        def expire_note_on_timeout():
            sleep(lifespan)
            self.note_expire.emit()
            
        t = Thread(target=expire_note_on_timeout)
        t.start()
    
        
    def set_links_on_signal(self, result, link):
        log.debug("Link result signal received: result: %s, link: %s" % (str(result), str(link)))
        if self.current_state != States.RUNNING:
            log.debug("Got the links, but the VM is not running. Returning")
            self.ui.btn_admin.setVisible(False)
            self.ui.btn_go_to_island.setVisible(False)
            return
        elif not result:
            log.warning("Unable to get connection links to access island. Network configuration is invalid")
            self.ui.btn_admin.setVisible(False)
            self.ui.btn_go_to_island.setVisible(False)
            self.show_note("Unable to connect to island. Network configuration is invalid.")
            return
        admin_exist = bool(is_admin_registered(self.config["data_folder"]))
        log.debug("admin exists: %s, data folder: %s" % (str(admin_exist), self.config["data_folder"]))
        self.ui.btn_admin.setVisible(True)
        if admin_exist:
            self.ui.btn_go_to_island.setVisible(True)
        else:
            self.show_note("Looks like you haven't set up your master password yet. Please click on \"Admin\" button and follow the instructions in the browser. You will be able to use your island once master password is set")
        connstr = "http://%s:%s" % (link, self.config["local_access_port"])
        self.local_access = connstr
        self.admin_access = "%s/%s" % (connstr, "admin")

    def open_island_link(self, admin=False):
        if self.current_state == States.RUNNING:
            webbrowser.open(self.admin_access) if admin else webbrowser.open(self.local_access) 
        else:
            log.error("Attempt to open a link while island is not running")
            
    def load_access_links(self):
        self.ui.btn_go_to_island.setVisible(False)
        self.ui.btn_admin.setVisible(False)
        worker = self._get_link_loader_worker()
        t = Thread(target=worker)
        t.start()

    def launch_background_links_updater(self):
        worker = self._get_link_loader_worker()
        def background_updater():
            while True:
                if self.current_state == States.RUNNING:
                    worker()
                    log.debug("links updated!")
                for _ in range(20):
                    if self.exiting:
                        return
                    sleep(.5)

        t = Thread(target=background_updater)
        t.start()

    def _get_link_loader_worker(self):
        def worker():
            counter = 0
            iterations = 5
            while self.current_state == States.RUNNING and counter < iterations:
                if self.exiting:
                    return
                vm_info = self.setup.get_vm_info()
                if vm_info is None:
                    log.error("VM info not found! That means that virtual machine is not registered with Virtualbox")
                    self.access_links_result.emit(False, "")
                    return
                if "Net1" in vm_info:
                    self.access_links_result.emit(True, vm_info["Net1"][1])
                    return
                else:
                    log.debug("Links not yet found. Retrying...")
                    counter += 1
                    sleep(2 + counter)
            if self.current_state == States.RUNNING:
                self.access_links_result.emit(False, "")

        return worker

    """ ~ END STATES """

    def show_notification(self, text):
        QM.warning(self, None, "Warning", text, buttons=QM.Ok)


    def quit_app(self, silent=False):
        if silent:
            self.exiting = True
            self.close()
            return

        if QM.question(self, "Exit confirm", "Quit the Island Manager?", QM.Yes | QM.No) == QM.Yes:
            log.debug("Quitting the islands manager...")
            self.exiting = True
            self.close()

    
            
    def show_hide(self):
        if self.isMinimized():
            self.activateWindow()
            self.showNormal()
        else:
            self.showMinimized()

    def process_tray_icon_activation(self, reason):
        log.debug("Tray icon activation detected!")
        if reason == QSystemTrayIcon.DoubleClick:
            log.debug("Tray icon double click detected")
            self.show_hide()

    def prepare_tray_menu(self, menu: QMenu):
        actions = {}
        quit_act = QAction("Quit", self)
        show_hide_act = QAction("Show / Hide", self)
        torrents_act = QAction("Torrents", self)
        start_island = QAction("Start Island", self)
        stop_island = QAction("Stop Island", self)
        restart_island = QAction("Restart Island", self)
        config_act = QAction("Config...", self)

        quit_act.setIcon(QIcon("resources/icons/exit.svg"))
        show_hide_act.setIcon(QIcon("resources/icons/plus-minus.png"))
        torrents_act.setIcon(QIcon("resources/icons/torrents.png"))
        start_island.setIcon(QIcon("resources/icons/play.png"))
        stop_island.setIcon(QIcon("resources/icons/stop.png"))
        restart_island.setIcon(QIcon("resources/icons/reload.png"))
        config_act.setIcon(QIcon("resources/icons/settings.png"))

        menu.addAction(show_hide_act)
        menu.addSeparator()
        menu.addActions([start_island, stop_island, restart_island])
        menu.addSeparator()
        menu.addAction(torrents_act)
        menu.addSeparator()
        menu.addAction(config_act)
        menu.addSeparator()
        menu.addAction(quit_act)

        torrents_act.triggered.connect(self.show_my_torrents)
        config_act.triggered.connect(self.open_config)
        quit_act.triggered.connect(self.quit_app)
        show_hide_act.triggered.connect(self.show_hide)
        start_island.triggered.connect(self.get_main_control_handler("launch"))
        stop_island.triggered.connect(self.get_main_control_handler("stop"))
        restart_island.triggered.connect(self.get_main_control_handler("restart"))

        start_island.setEnabled(False)
        stop_island.setEnabled(False)
        restart_island.setEnabled(False)

        actions["start"] = start_island
        actions["stop"] = stop_island
        actions["restart"] = restart_island
        actions["config"] = config_act
        actions["torrent"] = torrents_act
        actions["show"] = show_hide_act
        actions["quit"] = quit_act
        return actions
