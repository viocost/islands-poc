# -*- coding: utf-8 -*-

# Form implementation generated from reading ui file '../views/select_vm_form/select_vm_form.ui'
#
# Created by: PyQt5 UI code generator 5.11.3
#
# WARNING! All changes made in this file will be lost!

from PyQt5 import QtCore, QtGui, QtWidgets

class Ui_SelectVM(object):
    def setupUi(self, SelectVM):
        SelectVM.setObjectName("SelectVM")
        SelectVM.resize(478, 220)
        self.verticalLayout = QtWidgets.QVBoxLayout(SelectVM)
        self.verticalLayout.setObjectName("verticalLayout")
        self.label = QtWidgets.QLabel(SelectVM)
        self.label.setObjectName("label")
        self.verticalLayout.addWidget(self.label)
        self.vms_list = QtWidgets.QComboBox(SelectVM)
        self.vms_list.setObjectName("vms_list")
        self.verticalLayout.addWidget(self.vms_list)
        spacerItem = QtWidgets.QSpacerItem(20, 40, QtWidgets.QSizePolicy.Minimum, QtWidgets.QSizePolicy.Expanding)
        self.verticalLayout.addItem(spacerItem)
        self.horizontalLayout = QtWidgets.QHBoxLayout()
        self.horizontalLayout.setContentsMargins(0, -1, -1, -1)
        self.horizontalLayout.setSpacing(4)
        self.horizontalLayout.setObjectName("horizontalLayout")
        self.label_2 = QtWidgets.QLabel(SelectVM)
        self.label_2.setMinimumSize(QtCore.QSize(0, 0))
        self.label_2.setMaximumSize(QtCore.QSize(83, 16777215))
        self.label_2.setStyleSheet("color: red")
        self.label_2.setAlignment(QtCore.Qt.AlignHCenter|QtCore.Qt.AlignTop)
        self.label_2.setObjectName("label_2")
        self.horizontalLayout.addWidget(self.label_2)
        self.label_3 = QtWidgets.QLabel(SelectVM)
        self.label_3.setWordWrap(True)
        self.label_3.setObjectName("label_3")
        self.horizontalLayout.addWidget(self.label_3)
        self.verticalLayout.addLayout(self.horizontalLayout)
        self.buttonBox = QtWidgets.QDialogButtonBox(SelectVM)
        self.buttonBox.setOrientation(QtCore.Qt.Horizontal)
        self.buttonBox.setStandardButtons(QtWidgets.QDialogButtonBox.Cancel|QtWidgets.QDialogButtonBox.Ok)
        self.buttonBox.setObjectName("buttonBox")
        self.verticalLayout.addWidget(self.buttonBox)

        self.retranslateUi(SelectVM)
        self.buttonBox.accepted.connect(SelectVM.accept)
        self.buttonBox.rejected.connect(SelectVM.reject)
        QtCore.QMetaObject.connectSlotsByName(SelectVM)

    def retranslateUi(self, SelectVM):
        _translate = QtCore.QCoreApplication.translate
        SelectVM.setWindowTitle(_translate("SelectVM", "Select Virtual Machine"))
        self.label.setText(_translate("SelectVM", "Select existing virtual machine from the list:"))
        self.label_2.setText(_translate("SelectVM", "Warning!!!: "))
        self.label_3.setText(_translate("SelectVM", "Once you click \"Ok\", the current registered virtual machine will be unregistered and all settings will be reset! \n"
"The selected virtual machine will be registered as Islands."))

