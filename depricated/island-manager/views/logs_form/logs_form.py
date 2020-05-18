# -*- coding: utf-8 -*-

# Form implementation generated from reading ui file '../views/logs_form/logs_form.ui'
#
# Created by: PyQt5 UI code generator 5.12.2
#
# WARNING! All changes made in this file will be lost!

from PyQt5 import QtCore, QtGui, QtWidgets


class Ui_LogsForm(object):
    def setupUi(self, LogsForm):
        LogsForm.setObjectName("LogsForm")
        LogsForm.resize(1286, 672)
        self.verticalLayout_4 = QtWidgets.QVBoxLayout(LogsForm)
        self.verticalLayout_4.setObjectName("verticalLayout_4")
        self.horizontalLayout = QtWidgets.QHBoxLayout()
        self.horizontalLayout.setSpacing(14)
        self.horizontalLayout.setObjectName("horizontalLayout")
        self.btn_reload = QtWidgets.QPushButton(LogsForm)
        self.btn_reload.setMinimumSize(QtCore.QSize(0, 54))
        self.btn_reload.setObjectName("btn_reload")
        self.horizontalLayout.addWidget(self.btn_reload)
        self.verticalLayout = QtWidgets.QVBoxLayout()
        self.verticalLayout.setObjectName("verticalLayout")
        self.label = QtWidgets.QLabel(LogsForm)
        self.label.setObjectName("label")
        self.verticalLayout.addWidget(self.label)
        self.cb_filter = QtWidgets.QComboBox(LogsForm)
        self.cb_filter.setObjectName("cb_filter")
        self.cb_filter.addItem("")
        self.cb_filter.addItem("")
        self.cb_filter.addItem("")
        self.cb_filter.addItem("")
        self.cb_filter.addItem("")
        self.verticalLayout.addWidget(self.cb_filter)
        self.horizontalLayout.addLayout(self.verticalLayout)
        self.verticalLayout_2 = QtWidgets.QVBoxLayout()
        self.verticalLayout_2.setObjectName("verticalLayout_2")
        self.label_2 = QtWidgets.QLabel(LogsForm)
        self.label_2.setObjectName("label_2")
        self.verticalLayout_2.addWidget(self.label_2)
        self.cb_order = QtWidgets.QComboBox(LogsForm)
        self.cb_order.setObjectName("cb_order")
        self.cb_order.addItem("")
        self.cb_order.addItem("")
        self.verticalLayout_2.addWidget(self.cb_order)
        self.horizontalLayout.addLayout(self.verticalLayout_2)
        self.verticalLayout_3 = QtWidgets.QVBoxLayout()
        self.verticalLayout_3.setObjectName("verticalLayout_3")
        self.label_3 = QtWidgets.QLabel(LogsForm)
        self.label_3.setObjectName("label_3")
        self.verticalLayout_3.addWidget(self.label_3)
        self.lbl_logs_location = QtWidgets.QLabel(LogsForm)
        self.lbl_logs_location.setText("")
        self.lbl_logs_location.setObjectName("lbl_logs_location")
        self.verticalLayout_3.addWidget(self.lbl_logs_location)
        self.horizontalLayout.addLayout(self.verticalLayout_3)
        spacerItem = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Expanding, QtWidgets.QSizePolicy.Minimum)
        self.horizontalLayout.addItem(spacerItem)
        self.btn_clear = QtWidgets.QPushButton(LogsForm)
        self.btn_clear.setMinimumSize(QtCore.QSize(0, 54))
        self.btn_clear.setObjectName("btn_clear")
        self.horizontalLayout.addWidget(self.btn_clear)
        self.verticalLayout_4.addLayout(self.horizontalLayout)
        self.logs = QtWidgets.QTextBrowser(LogsForm)
        self.logs.setObjectName("logs")
        self.verticalLayout_4.addWidget(self.logs)

        self.retranslateUi(LogsForm)
        QtCore.QMetaObject.connectSlotsByName(LogsForm)

    def retranslateUi(self, LogsForm):
        _translate = QtCore.QCoreApplication.translate
        LogsForm.setWindowTitle(_translate("LogsForm", "Logs"))
        self.btn_reload.setText(_translate("LogsForm", "Reload"))
        self.label.setText(_translate("LogsForm", "Filter:"))
        self.cb_filter.setItemText(0, _translate("LogsForm", "All"))
        self.cb_filter.setItemText(1, _translate("LogsForm", "Debug"))
        self.cb_filter.setItemText(2, _translate("LogsForm", "Info"))
        self.cb_filter.setItemText(3, _translate("LogsForm", "Warning"))
        self.cb_filter.setItemText(4, _translate("LogsForm", "Error"))
        self.label_2.setText(_translate("LogsForm", "Order:"))
        self.cb_order.setItemText(0, _translate("LogsForm", "Earliest to latest"))
        self.cb_order.setItemText(1, _translate("LogsForm", "Latest to earliest"))
        self.label_3.setText(_translate("LogsForm", "Logs location:"))
        self.btn_clear.setText(_translate("LogsForm", "Clear logs"))


