import logging
import os

from PyQt5.QtWidgets import QDialog, QFileDialog

from lib.util import get_full_path, show_user_error_window, adjust_window_size
from views.create_torrent_form.create_torrent_form import Ui_CreateTorrentForm

log = logging.getLogger(__name__)


class CreateTorrentForm(QDialog):
    def __init__(self, parent, torrent_manager, config):
        super(QDialog, self).__init__(parent)
        self.config = config
        self.ui = Ui_CreateTorrentForm()
        self.torrent_manager = torrent_manager
        self.ui.setupUi(self)
        self.ui.btn_select.clicked.connect(self.select_data)
        self.ui.btn_cancel.clicked.connect(self.cancel)
        self.ui.btn_create.clicked.connect(self.create_torrent)
        adjust_window_size(self)
        
    def select_data(self):
        dialog = QFileDialog(self)
        res = None
        if self.ui.select_mode.currentIndex() == 0:
            # Selecting file
            res = QFileDialog.getOpenFileName(dialog, "Select file", get_full_path(self.config["homedir"]))
        elif self.ui.select_mode.currentIndex() == 1:
            res = QFileDialog.getExistingDirectory(dialog, "Select directory", get_full_path(self.config["homedir"]))
        else:
            log.error("File dialog error")
            return
        if res and res != ("", ""):
            path_to_data = res[0] if self.ui.select_mode.currentIndex() == 0 else res
            log.debug("Selected data: %s" % path_to_data)
            self.ui.path_to_data.setText(path_to_data)

    def create_torrent(self):
        log.debug("Attempting to create torrent")
        path_to_data = self.ui.path_to_data.text().strip(" ")
        if len(path_to_data) == 0:
            log.debug("No file selected")
            show_user_error_window(self, "No file or directory selected")
            return
        try:
            self.torrent_manager.create_torrent(os.path.abspath(path_to_data), self.ui.chk_start_seeding.isChecked())
            log.debug("Torrent created.")
            self.close()

        except Exception as e:
            msg = "Error creating torrent: %s" % str(e)
            log.error(msg)
            log.exception(e)
            raise e
            # show_user_error_window(self, msg)

    def cancel(self):
        self.close()

