# -*- coding: utf-8 -*-

# Form implementation generated from reading ui file '../views/help_form/help_form.ui'
#
# Created by: PyQt5 UI code generator 5.11.3
#
# WARNING! All changes made in this file will be lost!

from PyQt5 import QtCore, QtGui, QtWidgets

class Ui_HelpForm(object):
    def setupUi(self, HelpForm):
        HelpForm.setObjectName("HelpForm")
        HelpForm.resize(1042, 674)
        HelpForm.setStyleSheet("")
        self.verticalLayout = QtWidgets.QVBoxLayout(HelpForm)
        self.verticalLayout.setContentsMargins(0, 0, 0, 0)
        self.verticalLayout.setObjectName("verticalLayout")
        self.browser = QtWidgets.QTextBrowser(HelpForm)
        self.browser.setMaximumSize(QtCore.QSize(16777215, 16777215))
        self.browser.setBaseSize(QtCore.QSize(0, 0))
        font = QtGui.QFont()
        font.setFamily("Arial")
        font.setPointSize(18)
        font.setItalic(False)
        font.setKerning(False)
        self.browser.setFont(font)
        self.browser.setLayoutDirection(QtCore.Qt.LeftToRight)
        self.browser.setStyleSheet("color: #444")
        self.browser.setInputMethodHints(QtCore.Qt.ImhNone)
        self.browser.setOverwriteMode(True)
        self.browser.setObjectName("browser")
        self.verticalLayout.addWidget(self.browser)

        self.retranslateUi(HelpForm)
        QtCore.QMetaObject.connectSlotsByName(HelpForm)

    def retranslateUi(self, HelpForm):
        _translate = QtCore.QCoreApplication.translate
        HelpForm.setWindowTitle(_translate("HelpForm", "User guide"))
        self.browser.setHtml(_translate("HelpForm", "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.0//EN\" \"http://www.w3.org/TR/REC-html40/strict.dtd\">\n"
"<html><head><meta name=\"qrichtext\" content=\"1\" /><style type=\"text/css\">\n"
"p, li { white-space: pre-wrap; }\n"
"</style></head><body style=\" font-family:\'Arial\'; font-size:18pt; font-weight:400; font-style:normal;\">\n"
"<p align=\"justify\" style=\"-qt-paragraph-type:empty; margin-top:12px; margin-bottom:12px; margin-left:0px; margin-right:0px; -qt-block-indent:0; text-indent:0px;\"><br /></p></body></html>"))

