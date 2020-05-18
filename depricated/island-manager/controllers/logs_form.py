import datetime
import logging
import os
import re

from PyQt5.QtWidgets import QDialog, QMessageBox

from lib.util import get_full_path, adjust_window_size
from views.logs_form.logs_form import Ui_LogsForm

log = logging.getLogger(__name__)


class LogsForm(QDialog):
    def __init__(self, parent, logs_dir):
        super(QDialog, self).__init__(parent)
        self.ui = Ui_LogsForm()
        self.ui.setupUi(self)
        self.logs_dir = logs_dir
        self.logs_data = []
        self.load_logs()
        self.ui.lbl_logs_location.setText(get_full_path(logs_dir))
        self.order_logs()
        self.render_logs()
        self.ui.cb_order.currentIndexChanged.connect(self.apply_order)
        self.ui.cb_filter.currentIndexChanged.connect(self.apply_filter)
        self.ui.btn_reload.clicked.connect(self.reload_logs)
        self.ui.btn_clear.clicked.connect(self.clear_logs)
        adjust_window_size(self)
        self.show()

    def reload_logs(self):
        self.logs_data = []
        self.load_logs()
        self.order_logs()
        self.render_logs()

    def load_logs(self):
        log.debug("Loading logs")
        try:
            logfile1 = get_full_path(os.path.join(self.logs_dir, "islands_manager.log"))
            logfile2 = get_full_path(os.path.join(self.logs_dir, "islands_manager.log.1"))

            if os.path.exists(logfile1):
                with open(logfile1, "r") as fp:
                    regex = re.compile("^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2},\d{3}.+$")
                    self.logs_data += list(filter(regex.search, fp.read().split("\n")))

            if os.path.exists(logfile2):
                with open(logfile2, "r") as fp:
                    regex = re.compile("\d+.*\w+")
                    self.logs_data += list(filter(regex.search, fp.read().split("\n")))
        except Exception as e:
            log.error("Error loading logs: %s" % str(e))

    def order_logs(self, reverse=False):
        try:
            self.logs_data.sort(key=lambda x: datetime.datetime.strptime(" ".join(x.split(" ")[0:2]),
                                                                         "%Y-%m-%d %H:%M:%S,%f"), reverse=reverse)
        except Exception as e:
            log.error("Order logs error: %s" % str(e))


    def apply_filter(self):
        level_filter = {
            0: None,
            1: "DEBUG",
            2: "INFO",
            3: "WARNING",
            4: "ERROR"
        }
        self.render_logs(level_filter[self.ui.cb_filter.currentIndex()])

    def apply_order(self):
        self.order_logs(self.ui.cb_order.currentIndex() == 1)
        self.apply_filter()

    def clear_logs(self):
        if QMessageBox.question(self, "Confirm", "All logs will be deleted. Continue?",
                                QMessageBox.Yes | QMessageBox.No) == QMessageBox.Yes:
            print("Clearing all logs")
            l1 = get_full_path(os.path.join(self.logs_dir, "islands_manager.log"))
            l2 = get_full_path(os.path.join(self.logs_dir, "islands_manager.log.1"))
            if os.path.exists(l1):
                with open(l1, "w") as fp:
                    fp.write("")
            if os.path.exists(l2):
                with open(l2, "w") as fp:
                    fp.write("")
            self.logs_data = []
            self.render_logs()
        else:
            log.debug("Log clear cancel.")

    def render_logs(self, filter=None):
        log.debug("Rendering logs. Total records: %d" % len(self.logs_data))
        self.ui.logs.setText("")

        for record in self.logs_data:
            try:
                colors_map = {
                    "INFO": "blue",
                    "DEBUG": "gray",
                    "WARNING": "orange",
                    "ERROR": "red"
                }
                level = record.split(" ")[2]
                if filter is not None and level != filter:
                    continue
                colof = "black"
                if level in colors_map:
                    color = colors_map[level]
                self.ui.logs.append("<span style='font-family: Courier; color: {}'> {} </span> ".format(color, record))
            except Exception:
                pass
