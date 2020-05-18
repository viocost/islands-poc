import logging
import time

from PyQt5.QtCore import pyqtSignal, QEvent, Qt
from PyQt5.QtGui import QTextCursor
from PyQt5.QtWidgets import QDialog, QFileDialog, QMessageBox as QM

from lib.util import get_full_path, sizeof_fmt, show_user_error_window
from views.update_form.update_form import Ui_IslandsUpdate

log = logging.getLogger(__name__)


class UpdateForm(QDialog):
    output = pyqtSignal(str)
    progress = pyqtSignal(str, str, str, str, bool)
    download_timeout_signal = pyqtSignal()
    install_error = pyqtSignal(int, str)
    update_completed = pyqtSignal(bool, str)
    update_ui = pyqtSignal()
    unknown_key_confirm_request = pyqtSignal()
    configuration_in_progress_signal = pyqtSignal(bool)

    def __init__(self, parent, config, island_manager, setup):
        super(QDialog, self).__init__(parent)
        log.debug("Initializing update form")
        self.parent = parent
        self.config = config
        self.setup = setup
        self.island_manager = island_manager
        self.ui = Ui_IslandsUpdate()
        self.update_ui.connect(self.update_els_visibility)
        self.ui.setupUi(self)
        self.ui.opt_download.clicked.connect(self.update_els_visibility)
        self.ui.opt_from_file.clicked.connect(self.update_els_visibility)
        self.ui.btn_cancel.clicked.connect(self.close)
        self.ui.btn_update.clicked.connect(self.run_update)
        self.ui.magnet_link.textChanged.connect(self.update_els_visibility)
        self.ui.path_to_image.textChanged.connect(self.update_els_visibility)
        self.ui.btn_select_image_file.clicked.connect(self.select_image)
        self.ui.group_options.setId(self.ui.opt_download, 0)
        self.ui.group_options.setId(self.ui.opt_from_file, 1)
        self.ui.group_options.buttonClicked[int].connect(self.ui.stack_inputs.setCurrentIndex)
        self.output.connect(self.appender)
        self.progress.connect(self.progress_bar_handler)
        self.update_completed.connect(self.process_update_result)
        self.configuration_in_progress_signal.connect(self.process_configuration_in_progress)
        self.working = False
        self.download_timeout = False
        self.last_download_timeout = None
        self.configuration_in_progress = False
        self.installEventFilter(self)

    def update_els_visibility(self):
        log.debug("<================== UPDATING UI ==================> updating_els_visibility")
        from_file_checked = self.ui.opt_from_file.isChecked()
        download_checked = self.ui.opt_download.isChecked()

        update_enabled = ((from_file_checked and len(self.ui.path_to_image.text()) > 0) or
                          (download_checked and len(self.ui.magnet_link.text()) > 0)) and not self.working
        self.ui.btn_update.setEnabled(update_enabled)

    def process_configuration_in_progress(self, in_progress: bool):
        log.debug("Configuration in progress signal received")
        self.configuration_in_progress = in_progress
        self.ui.btn_cancel.setEnabled(not in_progress)

    def process_update_result(self, is_success, msg=""):
        self.working = False
        if is_success:
            QM.information(self, "Update successful", "Update completed successfully!", QM.Ok)
            self.close()
        else:
            self.lock_form(False)
            show_user_error_window(self, "UPDATE ERROR: %s " % msg)
            self.update_els_visibility()

    def init_progress_bar(self, title, size=None):
        ratio = "0/%d" % size if size is not None else ""
        self.progress_bar_handler(action='init',
                                  title=title,
                                  progress_in_percents="0",
                                  ratio=ratio,
                                  success=True)

    def update_progress_bar(self, progress, downloaded, total_size=None, title=None):
        ratio = "%s/%s" % (str(sizeof_fmt(downloaded)), str(
            sizeof_fmt(total_size))) if downloaded is not None and total_size \
            else ""
        title = title if title is not None else ""
        self.progress_bar_handler(action='update',
                                  title=title,
                                  progress_in_percents=str(progress),
                                  ratio=ratio,
                                  success=True)

    def finalize_progress_bar(self, progress=None, downloaded=None, total_size=None, title=None):
        ratio = "%s/%s" % (str(downloaded), str(total_size)) if downloaded is not None and total_size \
            else ""
        self.progress_bar_handler(
            action='finalize',
            title=title,
            progress_in_percents=str(progress),
            ratio=ratio,
            success=True)

    def on_download_timeout(self):
        msg = "Download seems to be stalled. It may be due to poor network connection " \
              "or torrent seeds are not reachable.\n You may cancel download at any time."
        self.last_download_timeout = time.time()
        self.download_timeout = True
        log.debug(msg)
        self.ui.lbl_timeout_msg.setText(msg)
        self.ui.lbl_timeout_msg.setVisible(True)
        self.update_els_visibility()

    def on_complete(self, msg, size=18, color='green', ):
        log.debug("<=================== Complete called! =============>")
        self.output.emit('<p style="color: {color}; font-size: {size}px"> {msg} </p>'
                         .format(msg=msg, size=size, color=color))
        self.update_ui.emit()

    def on_error(self, msg, size=12, color='red'):
        log.debug("GOT MESSAGE: %s" % msg)
        self.output.emit('<p style="color: {color}; font-size: {size}px"> {msg} </p>'
                         .format(msg=msg, size=size, color=color))
        self.update_ui.emit()

    def run_update(self):
        """
        Launches VM installation
        """
        log.debug("Running update")
        self.on_message("Initializing islands update")
        self.ui.output_console.setVisible(True)
        if not (self.ui.opt_from_file.isChecked() or self.ui.opt_download.isChecked()):
            msg = "None of VM update option are selected"
            log.debug(msg)
            show_user_error_window(self, msg)
            return
        if self.island_manager.is_running():
            self.on_message("Islands currently running. Shutting down...")
            self.island_manager.stop_island_sync(force=True)
            self.on_message("Islands was shut down. Now updating...")
        data_path = get_full_path(self.config["data_folder"])
        self.lock_form()
        log.info("Attempting to update islands VM...")
        self.unknown_key_confirm_request.connect(self.untrusted_key_confirm)
        self.lock_form(True)
        self.repaint()
        if self.ui.opt_download.isChecked():
            self.download_timeout_signal.connect(self.on_download_timeout)
        log.debug("Trying to import VM from %s " % self.ui.path_to_image.text())
        self.working = True
        self.setup.run_update(on_message=self.on_message,
                              on_complete=lambda res, opt_msg="": self.update_completed.emit(res, opt_msg),
                              on_error=self.on_error,
                              init_progres_bar=self.get_init_progress_bar_handler(),
                              update_progres_bar=self.get_update_progress_bar_handler(),
                              finalize_progres_bar=self.get_finalize_progress_bar_handler(),
                              download=self.ui.opt_download.isChecked(),
                              setup=self.setup,
                              island_manager=self.island_manager,
                              on_download_timeout=lambda: self.download_timeout_signal.emit(),
                              magnet_link=self.ui.magnet_link.text().strip(),
                              on_confirm_required=lambda: self.unknown_key_confirm_request.emit(),
                              image_path=self.ui.path_to_image.text().strip(),
                              config=self.config,
                              on_configuration_in_progress=lambda x: self.configuration_in_progress_signal.emit(x),
                              data_path=data_path)

    def lock_form(self, lock=True):
        log.debug("<================== UPDATING UI ==================> lock_form ")
        enbale_elements = not lock
        self.ui.opt_download.setEnabled(enbale_elements)
        self.ui.opt_from_file.setEnabled(enbale_elements)
        self.ui.btn_select_image_file.setEnabled(enbale_elements)
        self.ui.path_to_image.setEnabled(enbale_elements)
        self.ui.magnet_link.setEnabled(enbale_elements)
        self.ui.btn_update.setEnabled(enbale_elements)

    def closeEvent(self, event):
        log.debug("Closing update form")
        if self.configuration_in_progress:
            log.debug("Ignoring close event. Configuration in progress")
            event.ignore()
        elif self.working:
            log.debug("aborting install")
            self.setup.abort_install()

    def eventFilter(self, obj, event):
        if obj is self and event.type() == QEvent.KeyPress:
            log.debug("Received close event.")
            if event.key() in (Qt.Key_Return, Qt.Key_Escape, Qt.Key_Enter):
                return True
        return super(UpdateForm, self).eventFilter(obj, event)

    def set_installing(self):
        self.ui.output_console.setVisible(True)
        self.ui.opt_download.setEnabled(False)
        self.ui.opt_from_file.setEnabled(False)
        self.ui.magnet_link.setEnabled(False)
        self.ui.path_to_image.setEnabled(False)
        self.ui.btn_select_image_file.setEnabled(False)
        self.ui.btn_cancel.setEnabled(False)
        self.ui.btn_update.setEnabled(False)

    def select_image(self):
        res = QFileDialog.getOpenFileName(QFileDialog(self),
                                          "Select Islands image file",
                                          get_full_path(self.config['homedir']),
                                          "Islands image file (*.isld)")
        if res == ('', ''):
            print("Cancelled")
        else:
            self.ui.path_to_image.setText(res[0])

    def reset_console(self):
        self.ui.output_console.setText("")

    def appender(self, msg):
        self.ui.output_console.append(msg)
        sb = self.ui.output_console.verticalScrollBar()
        sb.setValue(sb.maximum())

    # Console event handlers
    # This handlers are used by setup installer to display the output and update status of
    # installation process
    def on_message(self, msg, size=12, color='blue'):
        log.debug("GOT MESSAGE: %s" % msg)
        self.output.emit('<p style="color: {color}; font-size: {size}px"> {msg} </p>'
                         .format(msg=msg, size=size, color=color))
        if self.download_timeout and (time.time() - self.last_download_timeout > 2):
            self.check_timeout()
            self.update_els_visibility()

    # Baking progress bar handlers
    def get_init_progress_bar_handler(self):
        def init_progress_bar(title, size=None):
            ratio = "0/%d" % size if size is not None else ""
            self.progress.emit('init', title, "0", ratio, True)

        return init_progress_bar

    def get_update_progress_bar_handler(self):
        def update_progress_bar(progress, downloaded, total_size=None, title=None):
            ratio = "%s/%s" % (str(sizeof_fmt(downloaded)), str(
                sizeof_fmt(total_size))) if downloaded is not None and total_size \
                else ""
            title = title if title is not None else ""
            self.progress.emit('update', title, str(progress), ratio, True)

        return update_progress_bar

    def get_finalize_progress_bar_handler(self):
        def finalize_progress_bar(progress=None, downloaded=None, total_size=None, title=None):
            ratio = "%s/%s" % (str(downloaded), str(total_size)) if downloaded is not None and total_size \
                else ""
            self.progress.emit('finalize', title, str(progress), ratio, True)

        return finalize_progress_bar

    def progress_bar_handler(self, action, title="", progress_in_percents="", ratio="", success=True):

        """This function initializes, updates and finalizes ASCII progress bar
        Args:
            console_index        -- window to output. Defined in constructor.
            action               -- can be init, update, and finalize
                                    init appends new progress bar to console
                                    update - rewrites previous line and sets updated values for progress and ratio
                                    finalize - rewrites last line in color depending  on success value
            title                -- line right above progress bar
            progress_in_percents -- exactly what it means
            ratio                -- optional and will appear as is on the right of the progress bar

            success              -- indicates whether operation succeeded. Only matters on finalize
        """

        def construct_progress_bar():
            multiple = .3
            fill = '='
            void = ' '
            fills = int(multiple * int(float(progress_in_percents)))
            whitespaces = int(multiple * 100) - fills
            return '<span style="font-family: Courier"><b> {:>3}% </b><span style="white-space: pre;">|{}>{}|</span> </span>{}'.format(
                progress_in_percents, fill * fills,
                void * whitespaces, ratio)

        def init_progress_bar():
            self.ui.output_console.append('<br><b>{title}</b>'.format(title=title))
            self.ui.output_console.append(construct_progress_bar())

        def update_progress_bar():
            b = construct_progress_bar()
            cursor = self.ui.output_console.textCursor()

            # Move cursor to the beginning of the line
            cursor.movePosition(QTextCursor.StartOfLine)
            cursor.movePosition(QTextCursor.EndOfBlock, QTextCursor.KeepAnchor)
            cursor.removeSelectedText()
            cursor.insertHtml(b)

        def finalize_progress_bar():
            color, content = ("green", "OK") if success else ("red", "ERROR")
            final_word = "<p style='color: {color}'>{content}</p>".format(color=color, content=content)
            self.ui.output_console.append(final_word)

        if action == "update":
            update_progress_bar()
        elif action == 'init':
            init_progress_bar()
        elif action == 'finalize':
            finalize_progress_bar()

        self.check_timeout()

    def check_timeout(self):
        log.debug("Checking timeout")
        if self.download_timeout and (time.time() - self.last_download_timeout > 2):
            log.debug("Resetting timeout")
            self.download_timeout = False
            self.last_download_timeout = None
            self.ui.lbl_timeout_msg.setText("")
            self.ui.lbl_timeout_msg.setVisible(False)
            self.update_els_visibility()
        else:
            log.debug("timeout not reset")

    def untrusted_key_confirm(self):
        msg = "Warning, the public key of the image you are trying to use is not registered as trusted.\n" + \
              "Would you like to import image anyway? The public key will be registered as trusted."
        res = QM.question(self, "Unknown public key", msg, QM.Yes | QM.No)
        if res == QM.Yes:
            self.setup.vm_installer.unknown_key_confirm_resume_update()
        else:
            self.process_update_result(False, "Error: untrusted key!")
