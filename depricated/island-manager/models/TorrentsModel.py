from PyQt5.QtCore import QAbstractTableModel, Qt, QTimer
from PyQt5.QtGui import QPixmap
from lib.util import sizeof_fmt
import logging
import resources_rc


STATES = {
  "checking_files":"Checking files",
    "downloading_metadata": "Downloading metadata",
    "downloading": "Downloading",
    "finished": "Finished",
    "seeding": "Seeding",
    "allocating": "Allocating",
    "checking_resume_data": "Checking resume data"
}

log = logging.getLogger(__name__)

class TorrentsModel(QAbstractTableModel):
    def __init__(self, parent, torrent_manager):
        log.debug("Initializing torrents model")
        QAbstractTableModel.__init__(self, parent)
        self.torrent_manager = torrent_manager
        self.header = ["Infohash" , "Name", "Status",  "Progress",  "Size"]
        self.timer = QTimer()
        self.model_data = self.get_data()
        self.timer.timeout.connect(self.updateModel)
        self.timer.start(2000)

    def headerData(self, col, orientation, role):
        if orientation == Qt.Horizontal and role == Qt.DisplayRole:
            return self.header[col]
        return None

    def get_data(self):
        self.model_data = self.torrent_manager.get_torrents_data()
        return [[
            t["infohash"],
            t["name"],
            STATES[str(t["state"])] if not t["paused"] else "Paused",
            "%.2f%%" % (t["progress"] * 100),
            "%s/%s" % (sizeof_fmt(t["total_done"]), sizeof_fmt(t["total"]))
        ] for t in self.model_data]

    def updateModel(self):
        self.model_data = self.get_data()
        self.layoutAboutToBeChanged.emit()
        self.dataChanged.emit(self.createIndex(0, 0), self.createIndex(self.rowCount(0), self.columnCount(0)))
        self.layoutChanged.emit()

    def data(self, index, role):
        row = index.row()
        col = index.column()
        if role == Qt.DisplayRole and index.isValid():
            return self.model_data[index.row()][index.column()]
        elif role == Qt.DecorationRole and index.isValid():
            pass
            # if col == 1:
            #     return QPixmap(":/images/icons/arrow-up-red.png")
        else:
            return None

    def rowCount(self, parent, *args, **kwargs):
        return len(self.model_data)

    def columnCount(self, parent=None, *args, **kwargs):
        return len(self.header)

    def flags(self, index):
        if not index.isValid():
            return Qt.NoItemFlags
        else:

            return Qt.ItemIsEnabled # | Qt.ItemIsSelectable
