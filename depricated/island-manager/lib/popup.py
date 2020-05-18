from PyQt5.QtWidgets import QLabel, QWidget, QGridLayout, QApplication
from PyQt5.QtCore import QTimer, QPropertyAnimation, Qt
from lib.application import Application

class QtPopup(QWidget):
    def __init__(self, parent, msg):
        super().__init__(self)
        self.setWindowFlags(Qt.FramelessWindowHint |
                            Qt.Tool |
                            Qt.WindowStaysOnTopHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_ShowWithoutActivating)
        self.animation.setTargetObject(self)
        self.animation.setPropertyName("popupOpacity")
        #self.animation.


    def show(self):
        self.setWindowOpacity(0.0)
        self.animation.setDuration(150)
        self.animation.setStartValue(0.0)
        self.animation.setEndValue(1.0)

        self.setGeometry(QApplication.desktop(Application.get_app()).availableGeometry().width() - 36 - self.width(), + QApplication.desktop())

    def hide(self):
        if self.getPopupOpacity() == 0.0:
            QWidget.hide(self)

    def setPopupOpacity(self, opacity):
        self.popupOpacity = opacity

    def getPopupOpacity(self):
        return self.popupOpacity