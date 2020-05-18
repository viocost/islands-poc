#! /usr/bin/env python
# -*- coding: utf-8 -*-
# vim:fenc=utf-8
#
# Copyright © 2018 kostia <kostia@i.planet-a.ru>
#
# Distributed under terms of the MIT license.


import sys
import signal
from PyQt5.QtWidgets import QApplication
from PyQt5.QtGui import QPixmap, QIcon
from lib.island_manager import IslandManager
from lib.island_setup import IslandSetup
from controllers.main_window import MainWindow
from lib.commander import Commander
from lib.file_manager import FileManager
from lib.torrent_manager import TorrentManager
import logging
from lib.app_ref import AppRef

log = logging.getLogger(__name__)


class Application:

    def __init__(self, config):
        self.config = config
        self.commander = Commander(self.config)
        self.file_manager = FileManager(self.config)
        self.torrent_manager = TorrentManager(self.config)
        self.app = self.prepare_app()
        self.setup = IslandSetup(config=self.config,
                                 commander=self.commander,
                                 file_manager=self.file_manager,
                                 torrent_manager=self.torrent_manager)
        self.island_manager = IslandManager(self.config, self.commander, self.setup)
        self.main_window = MainWindow(self.config, self.island_manager, self.setup, self.torrent_manager)

    # noinspection PyUnreachableCode

    def run(self):
        signal.signal(signal.SIGINT, lambda *args: self.kill())
        signal.signal(signal.SIGTERM, lambda *args: self.kill())
        self.app.startTimer(200)
        self.main_window.show()
        self.app.exec_()
        self.kill()
        sys.exit()

    # Prepares application instance and returns it
    def prepare_app(self):
        app = QApplication(sys.argv)
        appicon = QIcon()
        appicon.addPixmap(QPixmap(":/resources/images/icons/island24"))
        appicon.addPixmap(QPixmap(":/resources/images/icons/island32"))
        appicon.addPixmap(QPixmap(":/resources/images/icons/island64"))
        appicon.addPixmap(QPixmap(":/resources/images/icons/island128"))
        appicon.addPixmap(QPixmap(":/resources/images/icons/island256"))
        app.setWindowIcon(appicon)

        # This is needed for proper icon display in Windows task bar
        if sys.platform == "win32":
            import ctypes
            myappid = u'islands.manager'  # arbitrary string
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
        AppRef.set_app(app)
        return app

    def kill(self):
        print("Exiting!")
        self.main_window.quit_app(silent=True)
        self.torrent_manager.stop_session()
        self.app.quit()


if __name__ == "__main__":
    raise Exception("This module is not supposed to run as main")


class ApplicationNotInitialized(Exception):
    pass
