import logging
import os
import re
import shutil
from random import random
from threading import Thread
from time import sleep

from PyQt5.QtCore import pyqtSignal, QObject
from PyQt5.QtWidgets import QDialog, QFileDialog, QMessageBox, QInputDialog

from lib.image_authoring import ImageAuthoring
from lib.util import get_full_path, show_user_error_window, adjust_window_size
from lib.version_manager import ImageVersionManager, VersionBranchAlreadyExist
from views.image_authoring_form.image_authoring_form import Ui_ImageAuthoringForm

log = logging.getLogger(__name__)


class ImageAuthoringForm(QDialog):
    progress = pyqtSignal(str, int)
    error = pyqtSignal(str)
    success = pyqtSignal()

    def __init__(self, parent, config, key_manager, torrent_manager):
        super(QDialog, self).__init__(parent)
        self.key_manager = key_manager
        self.torrent_manager = torrent_manager
        self.config = config
        self.ui = Ui_ImageAuthoringForm()
        self.ui.setupUi(self)
        self.version_manager = ImageVersionManager(self.config)
        self.assign_handlers()
        self.fill_keys()
        self.fill_artifacts()
        self.update_elements()
        adjust_window_size(self)

    def assign_handlers(self):
        self.ui.btn_cancel.clicked.connect(self.cancel)
        self.ui.btn_go.clicked.connect(self.start_authoring)
        self.ui.btn_select_source.clicked.connect(self.select_source_file)
        self.ui.btn_select_dest_path.clicked.connect(self.select_dest_folder)
        self.ui.btn_create_artifact.clicked.connect(self.create_new_artifact)
        self.ui.select_private_key.currentIndexChanged.connect(self.fill_artifacts)
        self.ui.select_artifact.currentIndexChanged.connect(self.process_artifact_selected)
        self.ui.private_key_password.textChanged.connect(self.update_elements)
        self.ui.islands_version.textChanged.connect(self.update_elements)
        self.ui.image_release.textChanged.connect(self.update_elements)
        self.ui.image_modification.textChanged.connect(self.update_elements)
        self.ui.image_version.textChanged.connect(self.update_elements)
        self.ui.out_filename.textChanged.connect(self.update_elements)
        self.ui.source_file.textChanged.connect(self.update_elements)
        self.ui.path_to_dest.textChanged.connect(self.update_elements)
        self.progress.connect(self.on_progress)
        self.error.connect(self.on_error)
        self.success.connect(self.on_success)

    def process_artifact_selected(self):
        self.update_elements()
        self.ui.publisher_email.clear()
        self.ui.publisher.clear()
        self.ui.note.clear()
        self.ui.image_modification.clear()
        self.ui.image_version.clear()
        self.ui.image_release.clear()
        self.ui.out_filename.clear()
        self.ui.islands_version.clear()
        self.ui.lbl_prev_islands_version.setText("none")
        self.ui.lbl_previous_img_version.setText("none")

        log.debug("Processing artifact selected. Current artifact index is: %d | Current priv key index: %d " % (
            self.ui.select_artifact.currentIndex(), self.ui.select_private_key.currentIndex()
        ))
        if self.ui.select_artifact.currentIndex() <= 0 or self.ui.select_private_key.currentIndex() <= 0:
            return
        log.debug("Processing artifact selected")
        last_record = self.version_manager.get_last_release_record(self._get_selected_pkfp(),
                                                                   self.ui.select_artifact.currentText())

        if last_record:
            self.ui.publisher.setText(last_record["publisher"])
            self.ui.publisher_email.setText(last_record["publisher"])
            self.ui.note.setText(last_record["publisher"])

            prev_img_version = last_record["image_version"].split(".")
            if len(prev_img_version) == 3:
                self.ui.lbl_previous_img_version.setText(last_record["image_version"])
                self.ui.image_version.setText(prev_img_version[0])
                self.ui.image_release.setText(prev_img_version[1])
                mod = "%03d" % (int(prev_img_version[2]) + 1)
                self.ui.image_modification.setText(mod)
            else:
                self.ui.lbl_previous_img_version.setText("Could not parse: %s" % last_record["image_version"])

            self.ui.lbl_prev_islands_version.setText(last_record["islands_version"])
            self.ui.islands_version.setText(last_record["islands_version"])
            self.ui.publisher.setText(last_record["publisher"])
            self.ui.publisher_email.setText(last_record["email"])
            self.ui.note.setText(last_record["note"])
        else:
            self.ui.image_modification.setText("001")
            self.ui.image_version.setText("0")
            self.ui.image_release.setText("00")
        self.fill_out_filename()

    def fill_out_filename(self):
        new_version = self.construct_new_version("_")
        if new_version is not None:

            self.ui.out_filename.setText("islands_{artifact}_{version}.isld".format(
                artifact=self.ui.select_artifact.currentText(),
                version=new_version
            ))
        else:
            self.ui.out_filename.clear()

    def construct_new_version(self, delimiter="."):
        if not all([
            len(self.ui.image_release.text()) > 0,
            len(self.ui.image_version.text()) > 0,
            len(self.ui.image_modification.text()) > 0
        ]):
            return

        return delimiter.join([str(int(self.ui.image_version.text())),
                               ("%02d" % int(self.ui.image_release.text())),
                               "%03d" % int(self.ui.image_modification.text())
                               ])

    def fill_keys(self):
        user_keys = self.key_manager.get_user_private_keys_info()
        self.ui.select_private_key.addItem("None")
        self.ui.select_private_key.addItems(
            " || ".join(filter(None, [user_keys[key]["alias"], user_keys[key]["pkfp"]])) for key in user_keys.keys()
        )

    def on_progress(self, msg, progress):
        log.debug("Received progress signal")
        self.ui.lbl_action.setStyleSheet('color: "black"')
        self.ui.lbl_action.setText(msg)
        self.ui.progressBar.setValue(progress)

    def on_error(self, msg):
        self.ui.lbl_action.setText("ERROR! Authoring process has not been finished")
        self.ui.lbl_action.setStyleSheet('color: "red"')
        show_user_error_window(self, msg)

    def on_success(self):
        QMessageBox.information(QMessageBox(self), "Success", "Image authoring successfully completed!",
                                QMessageBox.Ok)
        log.debug("Closing authoring form")
        self.close()
        self.destroy()

    def update_elements(self):

        self.ui.groupBox_2.setEnabled(
            self.ui.select_private_key.currentIndex() > 0 and
            self.ui.select_artifact.currentIndex() > 0 and
            len(self.ui.private_key_password.text().strip()) > 0
        )

        self.ui.groupBox_3.setEnabled(
            self.ui.groupBox_2.isEnabled() and
            os.path.exists(self.ui.source_file.text()) and
            bool(re.search(r"^\d{1,4}\.\d{1,4}\.\d{1,4}$", self.ui.islands_version.text().strip()))

        )

        self.ui.groupBox_4.setEnabled(
            self.ui.groupBox_2.isEnabled() and
            self.ui.groupBox_3.isEnabled() and
            all(re.search(r"^\d{1,4}", x) for x in
                [self.ui.image_version.text().strip(), self.ui.image_modification.text().strip(),
                 self.ui.image_release.text().strip()])
        )

        self.ui.btn_go.setEnabled(all([
            self.ui.groupBox_2.isEnabled(),
            self.ui.groupBox_3.isEnabled(),
            self.ui.groupBox_4.isEnabled(),
            os.path.isdir(self.ui.path_to_dest.text().strip()),
            len(self.ui.out_filename.text().strip()) > 1
        ]))
        pk_chosen = self.ui.select_private_key.currentIndex() > 0
        self.ui.select_artifact.setEnabled(pk_chosen)
        self.ui.btn_create_artifact.setEnabled(pk_chosen)
        self.fill_out_filename()

    def fill_artifacts(self):
        self.ui.select_artifact.clear()
        self.ui.select_artifact.addItem("None")
        self.update_elements()
        if self.ui.select_private_key.currentIndex() == 0:
            return
        pkfp = self._get_selected_pkfp()
        artifacts = self.version_manager.get_artifacts(pkfp)
        if artifacts is not None:
            self.ui.select_artifact.addItems(artifacts)

    def create_new_artifact(self):
        if self.ui.select_private_key.currentIndex() == 0:
            log.error("Error creating version artifact: no private key selected")
            return

        res = QInputDialog.getText(self, "New artifact", "Enter new artifact name name")
        if res[1] and len(res[0].strip()) > 0:
            try:
                pkfp = self._get_selected_pkfp()
                self.version_manager.create_new_artifact(pkfp, res[0])
                log.debug("artifact file created")
            except VersionBranchAlreadyExist as e:
                QMessageBox.warning(self, "Error creating new artifact",
                                    "Artifact with this name already exists")
        self.fill_artifacts()

    def _get_selected_pkfp(self):
        if self.ui.select_private_key.currentIndex() == 0:
            return
        return self.ui.select_private_key.currentText().split("||")[1].strip()


    def select_source_file(self):
        log.debug("Selecting source image")
        res = QFileDialog.getOpenFileName(QFileDialog(self),
                                          "Select Islands image file",
                                          get_full_path(self.config['homedir']),
                                          "Virtual Appliance (*.ova)")
        if res == ("", ""):
            log.debug("Image select cancel")
        else:
            self.ui.source_file.setText(res[0])
            log.debug("Source path is %s" % (res[0]))

    def select_dest_folder(self):
        log.debug("Selecting dest dir")
        f_dialog = QFileDialog()
        f_dialog.setFileMode(QFileDialog.Directory)
        res = f_dialog.getExistingDirectory(self)
        if res:
            log.debug("Dest directory chosen: %s" % res)
            self.ui.path_to_dest.setText(res)
        else:
            log.debug("Directory selection cancelled")

    def prepare_version(self):
        version = self.ui.image_version.text()
        release = self.ui.image_release.text()
        modification = self.ui.image_modification.text()
        return ".".join([version, release, modification])

    def cancel(self):
        self.close()
        self.destroy()

    def start_authoring(self):
        log.debug("Starting authoring process...")
        if self.form_errors_found():
            log.debug("Form errors found. Aborting authoring")
            return
        self.ui.lbl_action.setText("Starting authoring process...")
        self.ui.progressBar.setValue(0)
        self.ui.progress_wrap.setVisible(True)
        log.debug("Starting thread")
        thread = Thread(target=self.process)
        thread.start()

    def process(self):
        log.debug("Thread started")
        sleep(1)
        temp_dir = None
        try:
            log.debug("Verifying user input")
            self.progress.emit("Verifying input...", 0)
            log.debug("Processing image authoring...")

            self.progress.emit("Verifying input...", 3)
            sleep(random())
            self.progress.emit("Initializing authoring master...", 3)
            image_authoring = ImageAuthoring(self.config, self.key_manager)
            image_version = self.prepare_version()
            islands_version = self.ui.islands_version.text()
            path_to_image = self.ui.source_file.text()
            output_path = self.ui.path_to_dest.text()
            output_filename = self.ui.out_filename.text()
            publisher = self.ui.publisher.text()
            note = self.ui.note.text()
            email = self.ui.publisher_email.text()
            private_pkfp = self._get_selected_pkfp()
            artifact = self.ui.select_artifact.currentText()
            log.debug(private_pkfp)
            key_password = self.ui.private_key_password.text(),
            key_password = key_password[0]
            log.debug(key_password)
            key_data = self.key_manager.get_private_key_data(private_pkfp)
            log.debug("Verifying data")
            image_authoring.verify_input(key_data, output_path, path_to_image)
            self.progress.emit("Verifying data...", 10)
            sleep(random())
            log.debug("creating temp folder")
            self.progress.emit("Preparing space...", 15)
            temp_dir = image_authoring.make_temp_dir(output_path)
            sleep(random())
            log.debug("Signing image")
            self.progress.emit("Signing image...", 17)
            ic = image_authoring.sign_source(key_data, key_password, path_to_image)
            log.debug("Creating info")
            self.progress.emit("Creating info...", 38)
            release_data = image_authoring.create_info(ic, image_version, islands_version, note, publisher, temp_dir,
                                                       email)
            self.progress.emit("Signing info info...", 48)
            image_authoring.sign_info(ic, temp_dir)
            self.progress.emit("Writing image..", 60)
            image_authoring.write_image(path_to_image, temp_dir)
            self.progress.emit("Packing...", 85)
            path_to_res = image_authoring.zip_up(output_filename, output_path, temp_dir)
            self.progress.emit("Cleaning up..", 95)
            image_authoring.cleanup(temp_dir)
            if self.ui.chk_seed_now.isChecked():
                self.torrent_manager.create_torrent(path_to_res, True)
            self.progress.emit("Saving release history", 98)
            self.version_manager.save_release_history(private_pkfp, artifact, release_data)
            sleep(random())
            self.progress.emit("Done!", 100)
            self.success.emit()
        except Exception as e:
            log.error("Image authoring error: %s" % str(e))
            log.exception(e)
            self.error.emit(str(e))
        finally:
            if temp_dir and os.path.isdir(temp_dir):
                shutil.rmtree(temp_dir)

    def start_seeding(self):
        pass

    def form_errors_found(self):
        log.debug("Verifying user input")
        log.debug("Checking image file")

        if not os.path.exists(self.ui.source_file.text()):
            show_user_error_window(self, "Source file not found...")
            return True
        if not os.path.isdir(self.ui.path_to_dest.text()):
            show_user_error_window(self, "Destination directory does not exist")
            return True
        required_fields = []

        if self.ui.private_key_password.text().strip(" ") == "":
            required_fields.append("Private key password")
        if self.ui.private_key_password.text().strip(" ") == "":
            required_fields.append("Island version")
        if self.ui.private_key_password.text().strip(" ") == "":
            required_fields.append("Image version")

        if len(required_fields) > 0:
            show_user_error_window(self, "Please fill the required fields: %s" % " ".join(required_fields))
            return True

        if self.ui.select_private_key.count() == 0:
            show_user_error_window(self, "You have not created your key yet. Create a key and try again")
            return True
        return False
