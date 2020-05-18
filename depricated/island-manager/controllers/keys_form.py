import logging

from PyQt5.QtWidgets import QDialog, QHeaderView, QMessageBox

from controllers.key_create_form import KeyCreateForm
from controllers.key_import_form import KeyImportForm
from lib.util import show_notification, adjust_window_size
from models.PrivateKeyTableModel import PrivateKeyTableModel
from models.PublicKeyTableModel import PublicKeyTableModel
from views.keys_form.keys_form import Ui_KeysForm

log = logging.getLogger(__name__)


class KeysForm(QDialog):
    def __init__(self, parent, key_manager, config, is_private_keys=False):
        """
        :param parent:
        :param key_manager:
        :param is_private_keys:
        """
        super(QDialog, self).__init__(parent)
        log.debug("Initializing keys form")
        self.key_manager = key_manager
        self.config = config
        self.ui = Ui_KeysForm()
        self.ui.setupUi(self)
        self.model = None
        self._is_private_keys = is_private_keys

        if is_private_keys:
            self.setup_private_keys_mode()
        else:
            self.setup_public_keys_mode()
        self.ui.table_keys.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.ui.btn_delete_key.clicked.connect(self.delete_key)
        self.ui.table_keys.clicked.connect(self.process_table_click)
        adjust_window_size(self)


    def process_table_click(self, index):
        log.debug("Processing table click: %d %d" % (index.row(), index.column()))

    def setup_private_keys_mode(self):
        log.debug("Setting private keys mode")
        self.ui.btn_create_key.setVisible(True)
        self.ui.btn_import_key.setVisible(True)
        self.model = PrivateKeyTableModel(self, key_manager=self.key_manager)
        self.ui.table_keys.setModel(self.model)
        self.ui.btn_import_key.clicked.connect(self.import_private_key)
        self.ui.btn_create_key.clicked.connect(self.create_user_key)
        self.setWindowTitle("My keys")

    def setup_public_keys_mode(self):
        log.debug("Setting public keys mode")
        self.ui.btn_add_key.setVisible(True)
        self.ui.btn_add_key.clicked.connect(self.import_public_key)
        self.model = PublicKeyTableModel(self, self.key_manager)
        self.ui.table_keys.setModel(self.model)
        self.setWindowTitle("Trusted keys")

    def create_user_key(self):
        log.debug("Create private key")
        create_key_dialog = KeyCreateForm(self, self.key_manager)
        create_key_dialog.exec()
        log.debug("Cey create dialog finished execution")
        self.model.updateModel()

    def import_private_key(self):
        log.debug("Add private key")
        import_key_form = KeyImportForm(parent=self,
                                        config=self.config,
                                        key_manager=self.key_manager,
                                        private=True)
        import_key_form.exec()
        self.model.updateModel()

    def import_public_key(self):
        log.debug("Add public key")
        import_key_form = KeyImportForm(parent=self,
                                        config=self.config,
                                        key_manager=self.key_manager)
        import_key_form.exec()
        self.model.updateModel()

    def delete_key(self):

        log.debug("Deleting key")
        select_model = self.ui.table_keys.selectionModel()
        if not select_model.hasSelection():
            log.debug("No key selected")
            show_notification(self, "No key is selected.")
            return
        confirm = QMessageBox.question(self, "Delete key",
                                       "The key will be deleted and forgotten. \n\nProceed?",
                                       QMessageBox.Yes | QMessageBox.No)
        if not confirm == QMessageBox.Yes:
            log.debug("Key deletion cancelled.")
            return
        selected_index = select_model.currentIndex()
        pkfp = self.model.data[selected_index.row()][0]
        self.key_manager.delete_key(pkfp, self._is_private_keys)
        self.model.removeRow(selected_index.row())
        self.model.updateModel()
