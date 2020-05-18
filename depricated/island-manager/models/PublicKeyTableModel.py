from PyQt5.QtCore import QAbstractTableModel, Qt
import logging

log = logging.getLogger(__name__)


class PublicKeyTableModel(QAbstractTableModel):
    def __init__(self, parent, key_manager):
        QAbstractTableModel.__init__(self, parent)
        self.key_manager = key_manager
        self.header = ["Public key fingerprint", "Alias"]
        self.data = self.get_data()

    def headerData(self, col, orientation, role):
        if orientation == Qt.Horizontal and role == Qt.DisplayRole:
            return self.header[col]
        return None

    def get_data(self):
        trusted_keys = self.key_manager.get_trusted_keys_info()
        for key in trusted_keys:
            log.debug(key)

        return [[trusted_keys[key]["pkfp"],
                 trusted_keys[key]["alias"] if "alias" in trusted_keys[key] else ""]
                for key in trusted_keys.keys()]

    def updateModel(self):
        self.layoutAboutToBeChanged.emit()
        self.data = self.get_data()
        self.dataChanged.emit(self.createIndex(0, 0), self.createIndex(self.rowCount(0), self.columnCount(0)))
        self.layoutChanged.emit()

    def data(self, index, role):
        if not index.isValid():
            return None
        if (index.column() == 0):
            value = self.data[index.row()][index.column()]
        else:
            value = self.data[index.row()][index.column()]
        if role == Qt.EditRole:
            return value
        elif role == Qt.DisplayRole:
            return value

    def rowCount(self, parent, *args, **kwargs):
        return len(self.data)

    def columnCount(self, parent=None, *args, **kwargs):
        return len(self.header)

    def flags(self, index):
        if not index.isValid():
            log.debug("Index is invalid. %d %d" % (index.row(), index.column()))
            return Qt.NoItemFlags
        if index.column() == 1:
            # return Qt::ItemIsEnabled | Qt::ItemIsSelectable | Qt::ItemIsUserCheckable
            return Qt.ItemIsEnabled | Qt.ItemIsSelectable | Qt.ItemIsEditable
        else:
            return Qt.ItemIsEnabled | Qt.ItemIsSelectable

    def setData(self, index, value, role=None):
        if role == Qt.EditRole:
            log.debug("Changing text:  %d %d  %s" % (index.row(), index.column(), value))
            if index.column() == 1:
                try:
                    self.key_manager.update_key_alias(self.data[index.row()][0], value)
                    log.debug("Alias successfully updated.")
                except FileNotFoundError:
                    log.debug("Alias change error: key not found")
                    return False
            self.data[index.row()][index.column()] = value
        return True


