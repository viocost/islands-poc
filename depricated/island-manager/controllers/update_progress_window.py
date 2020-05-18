from PyQt5.QtCore import QObject


class UpdateProgressWindow(QObject):
    def __init__(self, island_manager):
        QObject.__init__(self)
        self.islands_manager = island_manager
