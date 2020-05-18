from PyQt5.QtWidgets import QDialog

from views.select_vm_form.select_vm_form import Ui_SelectVM


class SelectVMForm(QDialog):
    def __init__(self, parent, setup):
        super(QDialog, self).__init__(parent)
        self.ui = Ui_SelectVM()
        self.ui.setupUi(self)
        self.setup = setup
        self.prepare_vm_list()


    def prepare_vm_list(self):
        self.ui.vms_list.clear()
        vms = self.setup.get_vm_list()
        for vm in vms:
            if len(vm[0]) > 1:
                self.ui.vms_list.addItem(vm[0])
