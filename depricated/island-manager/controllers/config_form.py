import logging
import time
from os.path import basename, normpath, join

from PyQt5.QtWidgets import QDialog, QFileDialog, QMessageBox as QM, QStatusBar, QVBoxLayout

from controllers.select_vm_form import SelectVMForm
from controllers.update_form import UpdateForm
from lib.island_manager import IslandManagerException
from lib.util import get_full_path, show_notification, show_user_error_window, adjust_window_size
from views.config_form.config_form import Ui_ConfigForm

log = logging.getLogger(__name__)


class ConfigForm(QDialog):
    def __init__(self, parent, config, setup, island_manager):
        super(QDialog, self).__init__(parent)
        self.config = config
        self.ui = Ui_ConfigForm()
        self.ui.setupUi(self)
        self.island_manager = island_manager
        self.setup = setup
        self.load_settings()
        self.state_changed = False
        self.refresh_required = False
        self.vm_info = None
        self.refresh_vm_info()
        self.assign_handlers()
        adjust_window_size(self)

    def setup_status_bar(self):
        ly = QVBoxLayout(self)
        bar = QStatusBar(self)
        ly.addWidget(bar)
        return bar

    def load_settings(self):
        self.ui.vboxmanagePathLineEdit.setText(get_full_path(self.config['vboxmanage']))

    def assign_handlers(self):
        self.ui.btn_refresh_info.clicked.connect(self.refresh_vm_info)
        self.ui.btn_del_vm.clicked.connect(self.process_delete_vm_request)
        self.ui.btn_update_vm.clicked.connect(self.process_vm_update)
        self.ui.btn_select_vm.clicked.connect(self.process_select_vm)
        self.ui.btn_configure_data.clicked.connect(self.configure_data_folder)
        self.ui.vboxmanageSelectPath.clicked.connect(self.vboxmanage_select_path)
        self.ui.vboxmanagePathLineEdit.textChanged.connect(self.vboxmanage_process_change)
        self.ui.vboxmanageDefault.clicked.connect(self.restore_default_vboxmanage_path)
        self.ui.vboxmanageSave.clicked.connect(self.save_vboxmanage_path)

    def restore_default_vmname(self):
        self.config.restore_default("vmname")
        self.refresh_required = True

    def restore_default_vboxmanage_path(self):
        self.config.restore_default("vboxmanage")
        self.ui.vboxmanagePathLineEdit.setText(get_full_path(self.config["vboxmanage"]))
        self.ui.vboxmanageSave.setEnabled(False)
        self.refresh_required = True

    def restore_default_data_folder_path(self):
        # Check if custom path is different from default
        # confirm
        if self.config.is_default("data_folder"):
            print("Already default")
            return
        res = QM.question(QM(self),
                          "Confirm",
                          "This will require stopping Islands. Continue?",
                          QM.Yes | QM.No)
        if res == QM.No:
            return
        print("Restoring default data folder")
        self.island_manager.restore_default_df_path()
        self.ui.dfLineEdit.setText(get_full_path(self.config['data_folder']))

    def process_delete_vm_request(self):
        res = QM.warning(self,
                         "Delete Island",
                         "This is going to unregister Island virtual machine, "
                         "wipe its files and reset VM settings to default. "
                         "Data files will be saved. Continue?",
                         QM.Yes | QM.No)
        if res == QM.Yes:
            try:
                if self.island_manager.is_running():
                    self.island_manager.stop_island_sync(force=True)
                    time.sleep(3)
                self.setup.delete_islands_vm()
                self.setup.reset_vm_config()
                self.refresh_vm_info()
                show_notification(self, "Island virtual machine has been deleted")

            except Exception as e:
                errmsg = "Island deletion error: %s " % str(e)
                log.error(errmsg)
                log.exception(e)
                show_user_error_window(self, errmsg)

    def process_vm_update(self):
        log.debug("opening update form")
        update_form = UpdateForm(self, self.config, self.island_manager, self.setup)
        update_form.exec()
        self.refresh_vm_info()
        log.debug("Update form is closed")

    def process_select_vm(self):
        log.debug("Selecting Islands VM...")
        select_form = SelectVMForm(self, self.setup)
        res = select_form.exec()
        if res == 1:
            selected_vm = str(select_form.ui.vms_list.currentText())
            self.config["vmname"] = selected_vm
            log.debug("Saving config and new vm info")
            self.config.save()
            log.debug("Updated. Refreshing VM info")
            self.refresh_vm_info()
            log.debug("Done.")

    def configure_data_folder(self):
        f_dialog = QFileDialog(self)
        res = f_dialog.getExistingDirectory(self, "Select directory",
                                            directory=get_full_path(self.config["homedir"]))
        if not res:
            return

        if get_full_path(res) == get_full_path(self.config["manager_data_folder"]):
            log.debug("Islands Manager data and Island data cannot be the same directory!")
            QM.warning(self,
                       "Error",
                       "Islands Manager data and Island data cannot be the same directory!",
                       QM.Ok)
            return
        if basename(normpath(res)) != self.config["shared_folder_name"]:
            res = join(res, self.config["shared_folder_name"])
        wmsg = "The virtual machine will be stopped now. Shared folder named islandsData will be unregistered " \
               "and selected directory will be mounted under islandsData name.\n\nSelected directory: %s\n\n" \
               "Proceed?" % res
        if QM.question(self,
                       "Confirm",
                       wmsg,
                       QM.Yes | QM.No) != QM.Yes:
            log.debug("Data folder config cancelled. Returning...")
            return
        log.debug("Configuring data dir to " + res)
        try:
            self.island_manager.set_new_datafolder(res)
            self.config["data_folder"] = res
            self.config.save()
            log.debug("Data folder configured")
            self.refresh_vm_info()
            QM.information(self, "Info", "Data folder configured successfully", QM.Ok)
        except IslandManagerException as e:
            errmsg = "Error configuring Island data directory: %s" % str(e)
            log.error(errmsg)
            QM.information(self, "Info", errmsg, QM.Ok)

    def save_datafolder_path(self):
        res = QM.question(self,
                          "Confirm",
                          "This will require stopping Islands. Continue?",
                          QM.Yes | QM.No)
        if res == QM.No:
            return
        print("saving new data folder")
        self.island_manager.set_new_datafolder(self.ui.dfLineEdit.text())
        self.ui.dfLineEdit.setText(get_full_path(self.config['data_folder']))

    def save_vboxmanage_path(self):
        try:
            self.setup.set_vboxmanage_path(self.ui.vboxmanagePathLineEdit.text())

        except Exception as e:
            show_notification(self, "Error setting vboxmanage path: %s" % str(e))

    def vboxmanage_process_change(self):
        self.ui.vboxmanageSave.setEnabled(
            self.ui.vboxmanagePathLineEdit.text() != get_full_path(self.config['vboxmanage'])
        )

    def vboxmanage_select_path(self):

        res = QFileDialog.getOpenFileName(parent=self,
                                          filter='vboxmanage.exe',
                                          directory=get_full_path(self.config['homedir']))
        if res != ('', ''):
            self.config['vboxmanage'] = get_full_path(res[0])
            self.config.save()
            self.ui.vboxmanagePathLineEdit.setText(get_full_path(self.config['vboxmanage']))

    def refresh_vm_info(self):
        log.debug("Refreshing VM info")
        vbox_set_up = self.setup.is_vbox_set_up()
        if vbox_set_up:
            self.vm_info = self.setup.get_vm_info()
            if self.vm_info is None:
                self.ui.lbl_vm_name.setText("not configured")
                self.ui.lbl_vm_name.setStyleSheet("color: gray")
                self.ui.vm_info.setText("")

            else:
                self.ui.lbl_vm_name.setText("%s  {%s}" % (self.vm_info["Name"], self.vm_info["UUID"]))
                self.ui.lbl_vm_name.setStyleSheet("color: blue")

                name = '<span style="color: black; margin-right: 5px; font-weight: 900"; font-size: 10px>{key}: </span>'
                val = '<span style="color: blue; margin-left: 5px; font-weight: 900"; font-size: 10px>{val}</span>'
                line = '<p>{content}</p>'
                self.ui.vm_info.setText("")
                for key in self.vm_info.keys():
                    self.ui.vm_info.append(line.format(
                        content="%s%s" % (name.format(key=key), val.format(val=str(self.vm_info[key])))
                    ))
        self.ui.btn_del_vm.setEnabled(vbox_set_up and self.vm_info is not None)
        self.ui.btn_configure_data.setEnabled(vbox_set_up and self.vm_info is not None)
        self.ui.btn_update_vm.setEnabled(vbox_set_up)
        self.ui.btn_select_vm.setEnabled(vbox_set_up)
