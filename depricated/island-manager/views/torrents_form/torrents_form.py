# -*- coding: utf-8 -*-

# Form implementation generated from reading ui file '../views/torrents_form/torrents_form.ui'
#
# Created by: PyQt5 UI code generator 5.11.3
#
# WARNING! All changes made in this file will be lost!

from PyQt5 import QtCore, QtGui, QtWidgets

class Ui_TorrentsForm(object):
    def setupUi(self, TorrentsForm):
        TorrentsForm.setObjectName("TorrentsForm")
        TorrentsForm.resize(1006, 633)
        TorrentsForm.setStyleSheet("")
        self.verticalLayout = QtWidgets.QVBoxLayout(TorrentsForm)
        self.verticalLayout.setSpacing(36)
        self.verticalLayout.setObjectName("verticalLayout")
        self.horizontalLayout = QtWidgets.QHBoxLayout()
        self.horizontalLayout.setSpacing(22)
        self.horizontalLayout.setObjectName("horizontalLayout")
        self.btn_add_torrent = QtWidgets.QPushButton(TorrentsForm)
        sizePolicy = QtWidgets.QSizePolicy(QtWidgets.QSizePolicy.Minimum, QtWidgets.QSizePolicy.Fixed)
        sizePolicy.setHorizontalStretch(0)
        sizePolicy.setVerticalStretch(0)
        sizePolicy.setHeightForWidth(self.btn_add_torrent.sizePolicy().hasHeightForWidth())
        self.btn_add_torrent.setSizePolicy(sizePolicy)
        self.btn_add_torrent.setMinimumSize(QtCore.QSize(180, 60))
        icon = QtGui.QIcon()
        icon.addPixmap(QtGui.QPixmap(":/images/plus"), QtGui.QIcon.Normal, QtGui.QIcon.Off)
        self.btn_add_torrent.setIcon(icon)
        self.btn_add_torrent.setIconSize(QtCore.QSize(32, 32))
        self.btn_add_torrent.setAutoDefault(False)
        self.btn_add_torrent.setObjectName("btn_add_torrent")
        self.horizontalLayout.addWidget(self.btn_add_torrent)
        self.btn_create_torrent = QtWidgets.QPushButton(TorrentsForm)
        self.btn_create_torrent.setMinimumSize(QtCore.QSize(180, 60))
        icon1 = QtGui.QIcon()
        icon1.addPixmap(QtGui.QPixmap(":/images/import"), QtGui.QIcon.Normal, QtGui.QIcon.Off)
        self.btn_create_torrent.setIcon(icon1)
        self.btn_create_torrent.setIconSize(QtCore.QSize(32, 32))
        self.btn_create_torrent.setAutoDefault(False)
        self.btn_create_torrent.setObjectName("btn_create_torrent")
        self.horizontalLayout.addWidget(self.btn_create_torrent)
        spacerItem = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Expanding, QtWidgets.QSizePolicy.Minimum)
        self.horizontalLayout.addItem(spacerItem)
        self.verticalLayout.addLayout(self.horizontalLayout)
        self.torrents_table = QtWidgets.QTableView(TorrentsForm)
        self.torrents_table.setStyleSheet("        QTableView{\n"
"            outline: 0;\n"
"        }\n"
"\n"
"        QTableView::item:focus {\n"
"\n"
"            outline: 0;\n"
"            border: none;\n"
"        }\n"
"\n"
"        QTableView::item:hover {\n"
"            background-color: #eff3f9;\n"
"            outline: 0;\n"
"            border: none;\n"
"        }")
        self.torrents_table.setProperty("showDropIndicator", False)
        self.torrents_table.setDragDropOverwriteMode(False)
        self.torrents_table.setSelectionMode(QtWidgets.QAbstractItemView.SingleSelection)
        self.torrents_table.setSelectionBehavior(QtWidgets.QAbstractItemView.SelectRows)
        self.torrents_table.setShowGrid(False)
        self.torrents_table.setCornerButtonEnabled(False)
        self.torrents_table.setObjectName("torrents_table")
        self.verticalLayout.addWidget(self.torrents_table)
        self.widget = QtWidgets.QWidget(TorrentsForm)
        self.widget.setObjectName("widget")
        self.horizontalLayout_2 = QtWidgets.QHBoxLayout(self.widget)
        self.horizontalLayout_2.setObjectName("horizontalLayout_2")
        self.line = QtWidgets.QFrame(self.widget)
        self.line.setStyleSheet("")
        self.line.setFrameShadow(QtWidgets.QFrame.Plain)
        self.line.setLineWidth(2)
        self.line.setFrameShape(QtWidgets.QFrame.VLine)
        self.line.setObjectName("line")
        self.horizontalLayout_2.addWidget(self.line)
        self.label_2 = QtWidgets.QLabel(self.widget)
        self.label_2.setMaximumSize(QtCore.QSize(23, 20))
        self.label_2.setText("")
        self.label_2.setPixmap(QtGui.QPixmap(":/images/icons/arrow-down-green.png"))
        self.label_2.setScaledContents(True)
        self.label_2.setObjectName("label_2")
        self.horizontalLayout_2.addWidget(self.label_2)
        self.lbl_download_speed = QtWidgets.QLabel(self.widget)
        self.lbl_download_speed.setObjectName("lbl_download_speed")
        self.horizontalLayout_2.addWidget(self.lbl_download_speed)
        self.btn_download_limit = QtWidgets.QPushButton(self.widget)
        self.btn_download_limit.setAutoFillBackground(False)
        self.btn_download_limit.setStyleSheet("QPushButton:!hover\n"
"{\n"
"    border: none;\n"
"}\n"
"\n"
"QPushButton:hover\n"
"{\n"
"  border: 1px solid #555;\n"
"  background-color: #bbb;\n"
"}")
        self.btn_download_limit.setAutoDefault(False)
        self.btn_download_limit.setFlat(True)
        self.btn_download_limit.setObjectName("btn_download_limit")
        self.horizontalLayout_2.addWidget(self.btn_download_limit)
        self.line_2 = QtWidgets.QFrame(self.widget)
        self.line_2.setStyleSheet("")
        self.line_2.setFrameShadow(QtWidgets.QFrame.Plain)
        self.line_2.setLineWidth(2)
        self.line_2.setMidLineWidth(1)
        self.line_2.setFrameShape(QtWidgets.QFrame.VLine)
        self.line_2.setObjectName("line_2")
        self.horizontalLayout_2.addWidget(self.line_2)
        self.label_4 = QtWidgets.QLabel(self.widget)
        sizePolicy = QtWidgets.QSizePolicy(QtWidgets.QSizePolicy.Preferred, QtWidgets.QSizePolicy.Preferred)
        sizePolicy.setHorizontalStretch(0)
        sizePolicy.setVerticalStretch(0)
        sizePolicy.setHeightForWidth(self.label_4.sizePolicy().hasHeightForWidth())
        self.label_4.setSizePolicy(sizePolicy)
        self.label_4.setMaximumSize(QtCore.QSize(20, 20))
        self.label_4.setStyleSheet("")
        self.label_4.setText("")
        self.label_4.setPixmap(QtGui.QPixmap(":/images/icons/arrow-up-red.png"))
        self.label_4.setScaledContents(True)
        self.label_4.setObjectName("label_4")
        self.horizontalLayout_2.addWidget(self.label_4)
        self.lbl_upload_speed = QtWidgets.QLabel(self.widget)
        self.lbl_upload_speed.setObjectName("lbl_upload_speed")
        self.horizontalLayout_2.addWidget(self.lbl_upload_speed)
        self.btn_upload_limit = QtWidgets.QPushButton(self.widget)
        self.btn_upload_limit.setAutoFillBackground(False)
        self.btn_upload_limit.setStyleSheet("QPushButton:!hover\n"
"{\n"
"    border: none;\n"
"}\n"
"\n"
"QPushButton:hover\n"
"{\n"
"  border: 1px solid #555;\n"
"  background-color: #bbb;\n"
"}")
        self.btn_upload_limit.setAutoDefault(False)
        self.btn_upload_limit.setFlat(True)
        self.btn_upload_limit.setObjectName("btn_upload_limit")
        self.horizontalLayout_2.addWidget(self.btn_upload_limit)
        self.line_5 = QtWidgets.QFrame(self.widget)
        self.line_5.setFrameShadow(QtWidgets.QFrame.Plain)
        self.line_5.setLineWidth(2)
        self.line_5.setFrameShape(QtWidgets.QFrame.VLine)
        self.line_5.setObjectName("line_5")
        self.horizontalLayout_2.addWidget(self.line_5)
        spacerItem1 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Expanding, QtWidgets.QSizePolicy.Minimum)
        self.horizontalLayout_2.addItem(spacerItem1)
        self.verticalLayout.addWidget(self.widget)

        self.retranslateUi(TorrentsForm)
        QtCore.QMetaObject.connectSlotsByName(TorrentsForm)

    def retranslateUi(self, TorrentsForm):
        _translate = QtCore.QCoreApplication.translate
        TorrentsForm.setWindowTitle(_translate("TorrentsForm", "Torrents"))
        self.btn_add_torrent.setText(_translate("TorrentsForm", "Add torrent"))
        self.btn_create_torrent.setText(_translate("TorrentsForm", "Create torrent"))
        self.lbl_download_speed.setText(_translate("TorrentsForm", "0 b/s"))
        self.btn_download_limit.setText(_translate("TorrentsForm", "Limit: ∞"))
        self.lbl_upload_speed.setText(_translate("TorrentsForm", "0 b/s"))
        self.btn_upload_limit.setText(_translate("TorrentsForm", "Limit: ∞"))

import resources_rc
