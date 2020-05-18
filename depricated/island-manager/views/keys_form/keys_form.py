# -*- coding: utf-8 -*-

# Form implementation generated from reading ui file '../views/keys_form/keys_form.ui'
#
# Created by: PyQt5 UI code generator 5.11.3
#
# WARNING! All changes made in this file will be lost!

from PyQt5 import QtCore, QtGui, QtWidgets

class Ui_KeysForm(object):
    def setupUi(self, KeysForm):
        KeysForm.setObjectName("KeysForm")
        KeysForm.resize(626, 407)
        self.verticalLayout = QtWidgets.QVBoxLayout(KeysForm)
        self.verticalLayout.setSpacing(43)
        self.verticalLayout.setObjectName("verticalLayout")
        self.horizontalLayout = QtWidgets.QHBoxLayout()
        self.horizontalLayout.setSpacing(5)
        self.horizontalLayout.setObjectName("horizontalLayout")
        self.btn_add_key = QtWidgets.QPushButton(KeysForm)
        self.btn_add_key.setVisible(False)
        self.btn_add_key.setStyleSheet("width: 130px; height: 40px; ")
        icon = QtGui.QIcon()
        icon.addPixmap(QtGui.QPixmap(":/images/plus"), QtGui.QIcon.Normal, QtGui.QIcon.Off)
        self.btn_add_key.setIcon(icon)
        self.btn_add_key.setIconSize(QtCore.QSize(32, 32))
        self.btn_add_key.setObjectName("btn_add_key")
        self.horizontalLayout.addWidget(self.btn_add_key)
        self.btn_create_key = QtWidgets.QPushButton(KeysForm)
        self.btn_create_key.setVisible(False)
        self.btn_create_key.setStyleSheet("width: 130px; height: 40px; ")
        self.btn_create_key.setIcon(icon)
        self.btn_create_key.setIconSize(QtCore.QSize(32, 32))
        self.btn_create_key.setObjectName("btn_create_key")
        self.horizontalLayout.addWidget(self.btn_create_key)
        self.btn_import_key = QtWidgets.QPushButton(KeysForm)
        self.btn_import_key.setVisible(False)
        self.btn_import_key.setStyleSheet("width: 130px; height: 40px; ")
        icon1 = QtGui.QIcon()
        icon1.addPixmap(QtGui.QPixmap(":/images/import"), QtGui.QIcon.Normal, QtGui.QIcon.Off)
        self.btn_import_key.setIcon(icon1)
        self.btn_import_key.setIconSize(QtCore.QSize(32, 32))
        self.btn_import_key.setObjectName("btn_import_key")
        self.horizontalLayout.addWidget(self.btn_import_key)
        self.btn_delete_key = QtWidgets.QPushButton(KeysForm)
        self.btn_delete_key.setStyleSheet("width: 130px; height: 40px; ")
        icon2 = QtGui.QIcon()
        icon2.addPixmap(QtGui.QPixmap(":/images/recycle"), QtGui.QIcon.Normal, QtGui.QIcon.Off)
        self.btn_delete_key.setIcon(icon2)
        self.btn_delete_key.setIconSize(QtCore.QSize(32, 32))
        self.btn_delete_key.setObjectName("btn_delete_key")
        self.horizontalLayout.addWidget(self.btn_delete_key)
        spacerItem = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Expanding, QtWidgets.QSizePolicy.Minimum)
        self.horizontalLayout.addItem(spacerItem)
        self.verticalLayout.addLayout(self.horizontalLayout)
        self.table_keys = QtWidgets.QTableView(KeysForm)
        self.table_keys.setAlternatingRowColors(True)
        self.table_keys.setSelectionBehavior(QtWidgets.QAbstractItemView.SelectRows)
        self.table_keys.setObjectName("table_keys")
        self.verticalLayout.addWidget(self.table_keys)

        self.retranslateUi(KeysForm)
        QtCore.QMetaObject.connectSlotsByName(KeysForm)

    def retranslateUi(self, KeysForm):
        _translate = QtCore.QCoreApplication.translate
        KeysForm.setWindowTitle(_translate("KeysForm", "Dialog"))
        self.btn_add_key.setText(_translate("KeysForm", "Add"))
        self.btn_create_key.setText(_translate("KeysForm", "Create"))
        self.btn_import_key.setText(_translate("KeysForm", "Import"))
        self.btn_delete_key.setText(_translate("KeysForm", "Delete"))

import resources_rc
