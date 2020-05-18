from PyQt5.QtWidgets import QWidget, QLabel, QVBoxLayout, QPushButton, QDialog
from PyQt5.QtGui import QPainter
from PyQt5.QtCore import Qt


class HelpGuide(QWidget):
    def __init__(self, parent, msg, element, pos=0):
        """

        :param parent:
        :param element:
        :param msg:
        :param pos: int 0-top, 1-right, 2-bottom, 3-left
        """
        super().__init__(parent=parent, flags=Qt.FramelessWindowHint)
        self.main_layout = QVBoxLayout()
        self.setLayout(self.main_layout)
        self.closeButton = QPushButton(self)
        self.closeButton.setText("X")
        self.closeButton.setStyleSheet("color: black")
        self.main_layout.addWidget(self.closeButton)
        self.setGeometry(10, 10, 400, 400)

        self.msg = QLabel(self)
        self.msg.setText(msg)
        self.main_layout.addWidget(self.msg)

        self.setAutoFillBackground(True)
        """
        self.setStyleSheet("
            background-color: #fff1e0;
            border: 1px solid #888;
            border-radius: 5px;
        ")
        """
