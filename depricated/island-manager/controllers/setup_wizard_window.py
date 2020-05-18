import logging
import sys
import time
from os import path
from PyQt5.QtCore import QEvent, pyqtSignal, Qt
from PyQt5.QtGui import QTextCursor
from PyQt5.QtWidgets import QMessageBox as QM, QWizard, QFileDialog, QInputDialog, QLineEdit

from lib import util
from views.setup_wizard.setup_wizard import Ui_IslandSetupWizard as UI_setup

log = logging.getLogger(__name__)

if sys.platform in ("linux", "darwin"):
    from os import getuid


class SetupWizardWindow(QWizard):
    # This signal will be emitted whenever there is something to append to output screen
    # First parameter is message,
    # second parameter is console index: 0 - first page, 1 - second page
    #
    output = pyqtSignal(str, int)
    progress = pyqtSignal(int, str, str, str, str, bool)
    update_elements = pyqtSignal()
    vbox_instal_complete = pyqtSignal(bool, str)
    unknown_key_confirm_request = pyqtSignal()
    download_timeout_signal = pyqtSignal()
    vm_install_completed = pyqtSignal(bool, str)
    install_error = pyqtSignal(int, str)
    configuration_in_progress_signal = pyqtSignal(bool)

    def __init__(self, parent, config, island_manager, setup):
        super(QWizard, self).__init__(parent)
        self.working = False
        self.config = config
        self.setup = setup
        self.ui = UI_setup()
        self.ui.setupUi(self)
        self.ui.button_install_vbox.setDefault(True)
        self.island_manager = island_manager
        self.assign_handlers()
        self.vm_install_in_progress = False

        self.consoles = {
            0: self.ui.vbox_setup_output_console,
            1: self.ui.vm_install_output_console
        }
        self.reset_consoles()
        self.vboxpage_prepare_text()
        self.update_ui_state()
        self.download_timeout = False
        self.last_timeout = None
        self.configuration_in_progress = False
        self.installEventFilter(self)
        util.adjust_window_size(self)
        
        
    # Handler for output signal
    def appender(self, msg, console_index):
        print("Appending message")
        if console_index not in self.consoles:
            raise InvalidConsoleIndex
        self.consoles[console_index].append(msg)
        self.scroll_to_end(self.ui.vm_install_output_console)
        self.check_timeout()

    # TODO Refactor
    def progress_bar_handler(self, console_index, action, title="", progress_in_percents="", ratio="", success=True):

        """This function initializes, updates and finalizes ASCII progress bar
        Args:
            console_index        -- window to output. Defined in constructor.
            action               -- can be init, update, and finalize
                                    init appends new progress bar to console
                                    update - rewrites previous line and sets updated values for progress and ratio
                                    finalize - rewrites last line in color depending  on success value
            title                -- line right above progress bar
            progress_in_percents -- exactly what it means
            ratio                -- optional and will appear as is on the right of the progress bar

            success              -- indicates whether operation succeeded. Only matters on finalize
        """
        if console_index not in self.consoles:
            raise KeyError

        def construct_progress_bar():
            multiple = .3
            fill = '='
            void = ' '
            fills = int(multiple * int(float(progress_in_percents)))
            whitespaces = int(multiple * 100) - fills
            return '<span style="font-family: Courier"><b> {:>3}% </b><span style="white-space: pre;">|{}>{}|</span> </span>{}'.format(
                progress_in_percents, fill * fills,
                void * whitespaces, ratio)

        def init_progress_bar():
            self.consoles[console_index].append('<br><b>{title}</b>'.format(title=title))
            self.consoles[console_index].append(construct_progress_bar())

        def update_progress_bar():
            b = construct_progress_bar()
            cursor = self.consoles[console_index].textCursor()

            # Move cursor to the beginning of the line
            cursor.movePosition(QTextCursor.StartOfLine)
            cursor.movePosition(QTextCursor.EndOfBlock, QTextCursor.KeepAnchor)
            cursor.removeSelectedText()
            cursor.insertHtml(b)

        def finalize_progress_bar():
            color, content = ("green", "OK") if success else ("red", "ERROR")
            final_word = "<p style='color: {color}'>{content}</p>".format(color=color, content=content)
            self.consoles[console_index].append(final_word)

        if action == "update":
            update_progress_bar()
        elif action == 'init':
            init_progress_bar()
        elif action == 'finalize':
            finalize_progress_bar()
        self.check_timeout()

    def assign_handlers(self):
        # BUTTONS' HANDLERS
        self.ui.button_install_vbox.clicked.connect(self.process_vbox_install)
        self.keyPressEvent = self.key_press_handler()
        self.output.connect(self.appender)
        self.progress.connect(self.progress_bar_handler)
        self.update_elements.connect(self.update_ui_state)
        self.vbox_instal_complete.connect(self.process_vbox_install_result)
        self.ui.opt_vm_local.clicked.connect(self.vm_install_page_update_state)
        self.ui.opt_download.clicked.connect(self.vm_install_page_update_state)
        self.ui.magnet_link.textChanged.connect(self.vm_install_page_update_state)
        self.ui.path_islands_vm.textChanged.connect(self.vm_install_page_update_state)
        self.ui.btn_install_islands.clicked.connect(self.proceed_vm_install)
        self.ui.btn_select_islands_vm_path.clicked.connect(self.select_islands_image)
        self.ui.btn_select_data_path.clicked.connect(self.select_data_folder)
        self.install_error.connect(self.process_install_error)
        self.vm_install_completed.connect(self.process_vm_install_result)
        self.configuration_in_progress_signal.connect(self.on_configuration_in_progress)

    def on_configuration_in_progress(self, in_progress: bool):
        log.debug("Configuration in progress signal received!")
        self.configuration_in_progress = in_progress

    def eventFilter(self, obj, event):
        if obj is self and event.type() == QEvent.KeyPress:
        #    if event.key() in (Qt.Key_Escape, Qt.Key_Return, Qt.Key_Enter):
        #        log.debug("Key press event")
        #        return True
            if event.type() == QEvent.Close:
                return True
        return super(SetupWizardWindow, self).eventFilter(obj, event)

    def closeEvent(self, event):
        log.debug("CLOSE EVENT!!")
        if self.configuration_in_progress:
            log.debug("Ignoring close event. Configuration in progress")
            event.ignore()
        elif self.confirm_abort_setup():
            log.debug("Aborting install")
            self.setup.abort_install()
        else:
            event.ignore()

    def key_press_handler(self):
        def handler(event):
            log.debug("In key press handler")
            if event.key() == Qt.Key_Escape:
                self.close()
        return handler

    def confirm_abort_setup(self):
        install_complete = self.setup.is_vbox_set_up and self.setup.is_islands_vm_exist()
        message = "Setup has not been finished and will be interrupted. Proceed? " \
            if not install_complete else ""
        message += "Quit setup wizzard?"
        res = QM.question(self, "Quit", message, QM.Yes | QM.No)
        return res == QM.Yes

    # Clear window outputs

    def process_install_error(self, code, msg):
        """
        Install error signal handler
        :param code:
        :param msg:
        :return:
        """
        log.error("Install error signal received. Code: %s Message: %s" % (str(code), str(msg)))
        util.show_user_error_window(self, msg)

    def reset_consoles(self):
        self.ui.vbox_setup_output_console.setText("")
        self.ui.vm_install_output_console.setText("")

    def scroll_to_end(self, console):
        sb = console.verticalScrollBar()
        sb.setValue(sb.maximum())

    def set_handlers(self):
        pass

    def on_close(self, handler):
        def close(event):
            res = QM.question(self, "Quit", "Quit setup wizzard?", QM.Yes | QM.No)
            if res == QM.Yes:
                event.accept()
                handler()
            else:
                event.ignore()

        return close

    def set_vbox_checker(self, handler):
        def is_complete():
            return handler()

        self.page(0).isComplete = is_complete

    def set_islands_vm_checker(self, handler):
        def is_complete():
            return handler()

        self.page(1).isComplete = is_complete

    # Appends text to a given console
    def process_output(self, data, output_type="regular", font_size=12):
        colors = {
            "regular": "black",
            "success": "green",
            "error": "red",
            "warning": "orange"
        }
        console = self.ui.vm_install_output_console
        if output_type not in colors:
            raise KeyError("Invalid output type")
        console.append("<p style='color:{color}; font_size:{font_size}'> {data} </p>"
                       .format(color=colors[output_type], font_size=font_size, data=data))

    # Opens select foldedialog
    def select_data_folder(self):
        f_dialog = QFileDialog()
        f_dialog.setFileMode(QFileDialog.Directory)
        res = f_dialog.getExistingDirectory(self)
        if res:
            self.ui.data_folder_path.setText(res)

    def process_vbox_install_result(self, res, msg):
        log.debug("Virtualbox installer finished. Success: %s" % str(res))
        self.configuration_in_progress_signal.emit(False)
        form_msg = """
            <p style='color: {color}; font-size: {font_size}'> {msg} </p>
        """
        if not res:
            self.appender(form_msg.format(color="red", font_size=16, msg="Virtualbox installation failed: %s" % msg), 0)
            self.ui.button_install_vbox.setEnabled(True)
        else:
            self.appender(form_msg.format(color="green", font_size=16, msg="Virtualbox installation successful."), 0)
            self.prepare_vm_setup_page()
        self.update_ui_state()

    def prepare_vm_setup_page(self):
        if self.setup.is_islands_vm_exist():
            self.ui.vm_install_status_label.setStyleSheet("color: green")
            self.ui.vm_install_status_label.setText("Islands virtual machine found. Click \"continue\" to proceed")
            self.set_visibility_vm_install_options(False)
        else:
            self.set_visibility_vm_install_options(True)
            self.ui.vm_install_status_label.setStyleSheet("color: orange")
            self.ui.vm_install_status_label.setText("Virtual machine not found... Let's install it.")

        self.ui.data_folder_path.setText(path.expandvars(self.config['data_folder']))
        self.set_visibility_vm_install_concole(False)
        self.ui.vm_install_output_console.setVisible(len(self.ui.vm_install_output_console.toPlainText()) > 0)

    # Console event handlers
    # This handlers are used by setup installer to display the output and update status of
    # installation process
    def get_on_message_handler(self, console):
        def on_message(msg, size=12, color='blue'):
            log.debug("GOT MESSAGE: %s" % msg)
            self.output.emit('<p style="color: {color}; font-size: {size}px"> {msg} </p>'
                             .format(msg=msg, size=size, color=color), console)

        return on_message

    def get_on_error_handler(self, console):
        def on_errror(msg, size=12, color='red'):
            log.debug("GOT MESSAGE: %s" % msg)
            self.output.emit('<p style="color: {color}; font-size: {size}px"> {msg} </p>'
                             .format(msg=msg, size=size, color=color), console)
            self.update_elements.emit()

        return on_errror

    def get_on_complete_handler(self, msg, console, handler=None):
        def on_complete(size=18, color='green', ):
            self.output.emit('<p style="color: {color}; font-size: {size}px"> {msg} </p>'
                             .format(msg=msg, size=size, color=color), console)
            self.update_elements.emit()
            if handler:
                handler()

        return on_complete

    # Console event handlers

    # Baking progress bar handlers
    def get_init_progress_bar_handler(self, console):
        def init_progress_bar(title, size=None):
            ratio = "0/%d" % size if size is not None else ""
            self.progress.emit(console, 'init', title, "0", ratio, True)

        return init_progress_bar

    def get_update_progress_bar_handler(self, console):
        def update_progress_bar(progress, downloaded, total_size=None, title=None):
            ratio = "%s/%s" % (str(util.sizeof_fmt(downloaded)), str(
                util.sizeof_fmt(total_size))) if downloaded is not None and total_size \
                else ""
            title = title if title is not None else ""
            self.progress.emit(console, 'update', title, str(progress), ratio, True)

        return update_progress_bar

    def get_finalize_progress_bar_handler(self, console):
        def finalize_progress_bar(progress=None, downloaded=None, total_size=None, title=None):
            ratio = "%s/%s" % (str(downloaded), str(total_size)) if downloaded is not None and total_size \
                else ""
            self.progress.emit(console, 'finalize', title, str(progress), ratio, True)

        return finalize_progress_bar

    # END progress bar handlers

    def process_vbox_install(self):
        vbox_installed = self.setup.is_vbox_installed()
        
        if vbox_installed:
            return

        self.consoles[0].setText("")
        self.ui.button_install_vbox.setEnabled(False)
        self.setup.run_vbox_installer(
            config=self.config,
            setup=self.setup,
            on_message=self.get_on_message_handler(console=0),
            on_complete=lambda is_success, msg: self.vbox_instal_complete.emit(is_success, msg),
            init_progres_bar=self.get_init_progress_bar_handler(0),
            update_progres_bar=self.get_update_progress_bar_handler(0),
            finalize_progres_bar=self.get_finalize_progress_bar_handler(0),
            on_configuration_in_progress=self.on_configuration_in_progress, 
            on_error=self.get_on_error_handler(console=0),
            update=vbox_installed
        )

    # Starts islands install process with choose image option
    def select_islands_image(self):

        res = QFileDialog.getOpenFileName(self,
                                          "Select Islands image",
                                          util.get_full_path(self.config['homedir']),
                                          "Islands Virtual Appliance (*.isld)")
        if res == ('', ''):
            log.debug("Image selection cancelled")
        else:
            log.debug("Islands image chosen for import: %s" % res[0])
            self.ui.path_islands_vm.setText(res[0])

    # Starts islands install process with image download option
    def download_install_islands(self):
        self.consoles[1].setText("")
        data_path = self.ui.data_folder_path.text()
        self.proceed_vm_install(data_path=data_path, download=True)

    def untrusted_key_confirm(self):
        msg = "Warning, the public key of the image you are trying to use is not registered as trusted.\n" + \
              "Would you like to import image anyway? The public key will be registered as trusted."
        res = QM.question(self, "Unknown public key", msg, QM.Yes | QM.No)
        if res == QM.Yes:
            self.setup.vm_installer.unknown_key_confirm_resume()
        else:
            self.vm_install_in_progress = False
            self.process_vm_install_result(False, "Error: untrusted key!")

    def process_vm_install_result(self, success, msg=None):
        """
        :param success bool:
        :param msg str:
        :return:
        """
        log.debug("On complete handler called")
        console = 1
        color = "green" if success else "red"
        size = 18
        resmsg = "Click \"continue\" to proceed" if success else \
            "Islands VM setup failed."
        if success:
            self.ui.vm_install_status_label.setText("Virtual machine now installed")
            self.ui.vm_install_status_label.setStyleSheet("color: green")
            self.button(QWizard.NextButton).setEnabled(True)
        else:
            self.ui.btn_install_islands.setEnabled(True)
            self.ui.btn_select_data_path.setEnabled(True)
            self.ui.btn_select_islands_vm_path.setEnabled(True)
            self.ui.opt_download.setEnabled(True)
            self.ui.opt_vm_local.setEnabled(True)
            self.ui.btn_select_data_path.setEnabled(True)
            self.ui.magnet_link.setEnabled(True)

        self.output.emit('<p style="color: {color}; font-size: {size}px"> {msg} </p>'
                         .format(msg=resmsg, size=size, color=color), console)
        self.vm_install_in_progress = False
        if msg:
            self.output.emit('<p style="color: {color}; font-size: {size}px"> {msg} </p>'
                             .format(msg=msg, size=14, color=color), console)
        self.vm_install_in_progress = False

    def on_download_timeout(self):
        msg = "Download is stalled. It may be due to poor network connection " \
              "or torrent seeds are not reachable.\n Press Esc to cancel download"
        log.debug(msg)
        self.ui.lbl_timeout_msg.setText(msg)
        self.ui.lbl_timeout_msg.setVisible(True)
        self.download_timeout = True
        self.last_timeout = time.time()

    def check_timeout(self):
        if self.download_timeout and (time.time() - self.last_timeout > 2):
            self.download_timeout = False
            self.last_timeout = None
            self.ui.lbl_timeout_msg.setText("")
            self.ui.lbl_timeout_msg.setVisible(False)

    def proceed_vm_install(self):
        """
        Launches VM installation
        """
        data_path = self.ui.data_folder_path.text()
        log.info("Attempting to installing islands VM...")
        self.ui.vm_install_output_console.setVisible(True)
        self.set_enabled_vm_install_options(False)
        self.unknown_key_confirm_request.connect(self.untrusted_key_confirm)
        self.ui.btn_install_islands.setEnabled(False)
        self.ui.btn_select_data_path.setEnabled(False)
        self.vm_install_in_progress = True
        if not (self.ui.opt_vm_local.isChecked() or self.ui.opt_download.isChecked()):
            msg = "None of VM install option are selected"
            log.debug(msg)
            util.show_user_error_window(self, msg)
            return
        if self.ui.opt_download.isChecked():
            self.download_timeout_signal.connect(self.on_download_timeout)
        log.debug("Trying to import VM from %s " % self.ui.path_islands_vm.text())
        self.setup.run_vm_installer(on_message=self.get_on_message_handler(console=1),
                                    on_complete=lambda is_success, opt_msg="":
                                    self.vm_install_completed.emit(is_success, opt_msg),
                                    on_error=self.get_on_error_handler(console=1),
                                    init_progres_bar=self.get_init_progress_bar_handler(console=1),
                                    update_progres_bar=self.get_update_progress_bar_handler(console=1),
                                    finalize_progres_bar=self.get_finalize_progress_bar_handler(console=1),
                                    download=not self.ui.opt_vm_local.isChecked(),
                                    setup=self.setup,
                                    island_manager=self.island_manager,
                                    on_download_timeout=lambda: self.download_timeout_signal.emit(),
                                    magnet_link=self.ui.magnet_link.text().strip(),

                                    on_configuration_in_progress=lambda x: self.configuration_in_progress_signal.emit(
                                        x),
                                    on_confirm_required=lambda: self.unknown_key_confirm_request.emit(),
                                    image_path=self.ui.path_islands_vm.text().strip(),
                                    config=self.config,
                                    data_path=data_path)

    def vboxpage_prepare_text(self):
        self.ui.vbox_setup_output_console.append(SetupMessages.checking_vbox())
        if not self.setup.is_vbox_installed():
            self.ui.vbox_setup_output_console.append(SetupMessages.virtualbox_not_installed())
            self.ui.vbox_setup_output_console.append(SetupMessages.vb_not_installed_instructions())

        elif not self.setup.is_vbox_up_to_date():
            self.ui.vbox_setup_output_console.append(SetupMessages.virtualbox_update_required())
            self.ui.vbox_setup_output_console.append(SetupMessages.virtualbox_update_required_instructions())

        else:
            self.ui.vbox_setup_output_console.append(SetupMessages.virtualbox_found())
            self.ui.vbox_setup_output_console.append(SetupMessages.vb_installed_instructions())
            self.prepare_vm_setup_page()

    def update_ui_state(self):
        """Checks setup condition and updates ALL elements accordingly

           possible states:
           Virtualbox installed, requires update, not installed
           Active page: 1, 2, 3
           VM installed, not installed

        """
        self.button(self.BackButton).setEnabled(False)
        current_page_id = self.get_active_page_id()
        vbox_installed = self.setup.is_vbox_installed()
        vbox_up_to_date = False if not vbox_installed else self.setup.is_vbox_up_to_date()
        islands_vm_installed = vbox_installed and vbox_up_to_date and \
                               self.setup.is_islands_vm_exist()

        self.ui.button_install_vbox.setVisible(not (vbox_installed and vbox_up_to_date))
        self.ui.button_install_vbox.setEnabled(not (vbox_installed and vbox_up_to_date))

        if not vbox_installed:
            self.ui.button_install_vbox.setText("Install Virtualbox")
        else:
            self.ui.button_install_vbox.setText("Update Virtualbox")

        vm_install_ready = (vbox_installed
                            and vbox_up_to_date and not islands_vm_installed)

        self.ui.data_folder_path.setEnabled(vm_install_ready)
        self.ui.btn_select_data_path.setEnabled(vm_install_ready)
        self.button(QWizard.BackButton).setEnabled(not vm_install_ready or current_page_id != 0
                                                   or not islands_vm_installed)
        self.button(QWizard.NextButton).setEnabled((current_page_id == 0 and vbox_installed and vbox_up_to_date)
                                                   or current_page_id == 1 and islands_vm_installed and not self.vm_install_in_progress)
        self.button(QWizard.FinishButton).setEnabled(current_page_id == 2 and vbox_installed and
                                                     vbox_up_to_date and islands_vm_installed)
        self.scroll_to_end(self.ui.vbox_setup_output_console)
        self.scroll_to_end(self.ui.vm_install_output_console)
        self.vm_install_page_update_state()

    def vm_install_page_update_state(self):
        """
        Sets visibility of all elements on the page depending current on state
        :param islands_vm_installed:
        :return:
        """

        opt_download_checked = self.ui.opt_download.isChecked()
        opt_vm_local_checked = self.ui.opt_vm_local.isChecked()
        self.ui.btn_select_islands_vm_path.setVisible(opt_vm_local_checked)
        self.ui.path_islands_vm.setVisible(opt_vm_local_checked)
        self.ui.magnet_link.setVisible(opt_download_checked)

        self.ui.btn_install_islands.setEnabled(
            ((opt_download_checked and len(self.ui.magnet_link.text()) > 0) or
             (opt_vm_local_checked and len(self.ui.path_islands_vm.text()) > 0)) and not self.vm_install_in_progress
        )
        self.repaint()

    def set_visibility_vm_install_options(self, visibility: bool):
        self.ui.install_choice_label.setVisible(visibility)
        self.ui.opt_download.setVisible(visibility)
        self.ui.opt_vm_local.setVisible(visibility)

    def set_enabled_vm_install_options(self, enabled):
        self.ui.install_choice_label.setEnabled(enabled)
        self.ui.opt_download.setEnabled(enabled)
        self.ui.opt_vm_local.setEnabled(enabled)
        self.ui.magnet_link.setEnabled(enabled)
        self.ui.path_islands_vm.setEnabled(enabled)
        self.ui.btn_select_islands_vm_path.setEnabled(enabled)

    def set_visibility_vm_install_concole(self, visibility: bool):
        self.ui.vm_install_output_console.setVisible(visibility)

    def reset_vm_install_options(self):
        self.ui.opt_vm_local.setChecked(False)
        self.ui.opt_download.setChecked(False)

    def get_active_page_id(self):
        return self.currentId()


class SetupMessages:
    @staticmethod
    def virtualbox_found():
        return """  
                <p><b style='color:green; font-size:18px; margin-bottom:20px;'>Virtualbox found</b></p>
             """

    @staticmethod
    def virtualbox_installed():
        return """  
                <p><b style='color:green; font-size:18px; margin-bottom:20px;'>Virtualbox successfully installed!</b></p>
             """

    @staticmethod
    def virtualbox_not_installed():
        return """  
            <p><b style='color:orange; font-size:18px; margin-bottom:20px;'>Virtualbox not installed</b></p>
                 """

    @staticmethod
    def virtualbox_update_required():
        return """  
            <p><b style='color:orange; font-size:18px; margin-bottom:20px;'>Virtualbox update required</b></p>
                 """

    @staticmethod
    def virtualbox_update_required_instructions():
        return """  
            <p style='font-size=15px'>Click <b>Update Virtualbox</b> to download and install newest version of Virtualbox automatically</p>
                 """

    @staticmethod
    def vb_installed_instructions():
        return """
            <p>Please click <b>"Continue"</b> </p>
        """

    @staticmethod
    def vb_not_installed_instructions():
        return """  
         <p style='font-size=15px'>Click <b>Install virtualbox</b> to download/install virtualbox automatically.</p>          
         """

    @staticmethod
    def dloading_vb():
        return """
        <p>Downloading virtualbox...</p>
        """

    @staticmethod
    def installing_vb():
        return """
                <p>Installing virtualbox...</p>
        """

    @staticmethod
    def checking_vbox():
        return """
            <p>Checking virtualbox installation...</p>
        """

    @staticmethod
    def vm_found():
        return """
             <p><b style='color:green; font-size:18px; margin-bottom:20px;'>Islands virtual machine found!</b></p>
        """

    @staticmethod
    def vm_not_found():
        return """
             <p><b style='color:orange; font-size:18px; margin-bottom:20px;'>Islands virtual machine not found!</b></p>
        """

    @staticmethod
    def vm_found_instructions():
        return """  
         <br><p style='font-size=15px'>Please click <b>Continue</b></p> 
         """

    @staticmethod
    def vm_not_found_instructions():
        return """  
         <p style='font-size=15px'>Click <b>Install Islands VM</b> to download/install Islands automatically  </p>
         <br>          
         <p style='font-size=12px'> If you have previously downloaded Islands VM in OVA format 
          please click <b>Import OVA</b> and select islands OVA image file</p>
                             
         """


class InvalidConsoleIndex(Exception):
    pass
