# -*- coding: utf-8 -*-

# Form implementation generated from reading ui file '..\views\create_torrent_form\create_torrent_form.ui'
#
# Created by: PyQt5 UI code generator 5.11.3
#
# WARNING! All changes made in this file will be lost!

from PyQt5 import QtCore, QtGui, QtWidgets

class Ui_CreateTorrentForm(object):
    def setupUi(self, CreateTorrentForm):
        CreateTorrentForm.setObjectName("CreateTorrentForm")
        CreateTorrentForm.resize(397, 220)
        self.verticalLayout = QtWidgets.QVBoxLayout(CreateTorrentForm)
        self.verticalLayout.setSpacing(19)
        self.verticalLayout.setObjectName("verticalLayout")
        self.horizontalLayout_3 = QtWidgets.QHBoxLayout()
        self.horizontalLayout_3.setObjectName("horizontalLayout_3")
        spacerItem = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Expanding, QtWidgets.QSizePolicy.Minimum)
        self.horizontalLayout_3.addItem(spacerItem)
        self.label = QtWidgets.QLabel(CreateTorrentForm)
        self.label.setObjectName("label")
        self.horizontalLayout_3.addWidget(self.label)
        self.select_mode = QtWidgets.QComboBox(CreateTorrentForm)
        self.select_mode.setObjectName("select_mode")
        self.select_mode.addItem("")
        self.select_mode.addItem("")
        self.horizontalLayout_3.addWidget(self.select_mode)
        self.verticalLayout.addLayout(self.horizontalLayout_3)
        self.horizontalLayout = QtWidgets.QHBoxLayout()
        self.horizontalLayout.setObjectName("horizontalLayout")
        self.path_to_data = QtWidgets.QLineEdit(CreateTorrentForm)
        self.path_to_data.setReadOnly(True)
        self.path_to_data.setObjectName("path_to_data")
        self.horizontalLayout.addWidget(self.path_to_data)
        self.btn_select = QtWidgets.QPushButton(CreateTorrentForm)
        self.btn_select.setObjectName("btn_select")
        self.horizontalLayout.addWidget(self.btn_select)
        self.verticalLayout.addLayout(self.horizontalLayout)
        spacerItem1 = QtWidgets.QSpacerItem(20, 17, QtWidgets.QSizePolicy.Minimum, QtWidgets.QSizePolicy.Expanding)
        self.verticalLayout.addItem(spacerItem1)
        self.chk_start_seeding = QtWidgets.QCheckBox(CreateTorrentForm)
        self.chk_start_seeding.setLayoutDirection(QtCore.Qt.RightToLeft)
        self.chk_start_seeding.setChecked(True)
        self.chk_start_seeding.setObjectName("chk_start_seeding")
        self.verticalLayout.addWidget(self.chk_start_seeding)
        self.horizontalLayout_2 = QtWidgets.QHBoxLayout()
        self.horizontalLayout_2.setObjectName("horizontalLayout_2")
        spacerItem2 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Expanding, QtWidgets.QSizePolicy.Minimum)
        self.horizontalLayout_2.addItem(spacerItem2)
        self.btn_cancel = QtWidgets.QPushButton(CreateTorrentForm)
        self.btn_cancel.setMinimumSize(QtCore.QSize(0, 40))
        self.btn_cancel.setObjectName("btn_cancel")
        self.horizontalLayout_2.addWidget(self.btn_cancel)
        self.btn_create = QtWidgets.QPushButton(CreateTorrentForm)
        self.btn_create.setMinimumSize(QtCore.QSize(0, 40))
        self.btn_create.setStyleSheet("color: \"green\"")
        self.btn_create.setDefault(True)
        self.btn_create.setObjectName("btn_create")
        self.horizontalLayout_2.addWidget(self.btn_create)
        self.verticalLayout.addLayout(self.horizontalLayout_2)

        self.retranslateUi(CreateTorrentForm)
        QtCore.QMetaObject.connectSlotsByName(CreateTorrentForm)

    def retranslateUi(self, CreateTorrentForm):
        _translate = QtCore.QCoreApplication.translate
        CreateTorrentForm.setWindowTitle(_translate("CreateTorrentForm", "Create torrent"))
        self.label.setText(_translate("CreateTorrentForm", "Mode: "))
        self.select_mode.setItemText(0, _translate("CreateTorrentForm", "File"))
        self.select_mode.setItemText(1, _translate("CreateTorrentForm", "Directory"))
        self.path_to_data.setPlaceholderText(_translate("CreateTorrentForm", "Path to data"))
        self.btn_select.setText(_translate("CreateTorrentForm", "Select..."))
        self.chk_start_seeding.setText(_translate("CreateTorrentForm", "Start seeding immediately"))
        self.btn_cancel.setText(_translate("CreateTorrentForm", "Cancel"))
        self.btn_create.setText(_translate("CreateTorrentForm", "Create!"))

