#! /usr/bin/env python
# -*- coding: utf-8 -*-
# vim:fenc=utf-8
#
# Copyright © 2018 Kostia <viocost@gmail.com>
#
# Distributed under terms of the MIT license.

from lib.application import Application
from lib.im_config import IMConfig
from logging.handlers import RotatingFileHandler
from lib.util import get_full_path
import sys, os
import logging
import argparse
import fasteners
import tempfile

def main(*args):
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument('--debug', help="Running in debug mode", action="store_true")
        parsed = parser.parse_args()

        config = IMConfig(sys.platform)
        setup_logger(config, parsed.debug)
        log = logging.getLogger(__name__)
        lock_filename = "islands_lock"
        lock_filepath = os.path.join(tempfile.gettempdir(), lock_filename)
        lock = fasteners.InterProcessLock(lock_filepath)
        gotten = lock.acquire(blocking=False)
        if gotten:
            application = Application(config)
            application.run()
        else:
            log.info("Another instance of Island Manager is already running. Exiting...")
            sys.exit(0)
    except Exception as e:
        msg = "Application has crashed: %s" % str(e)
        print(msg)
        log = logging.getLogger(__name__)
        log.error(msg)
        sys.exit(1)


# noinspection PyUnreachableCode
def setup_logger(config, debug):
    logger = logging.getLogger()
    if debug:
        print("Setting logging to debug mode")
        logger.setLevel(logging.DEBUG)
        handler = logging.StreamHandler(sys.stdout)
        logger.addHandler(handler)
    else:
        print("Setting logging to production mode")
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler(sys.stdout)
        logger.addHandler(handler)

    manager_path = get_full_path(config["manager_data_folder"])
    if not os.path.exists(manager_path):
        os.mkdir(manager_path)
    log_path = os.path.join(manager_path, "islands_manager.log")
    file_handler = RotatingFileHandler(log_path, mode="a", maxBytes=5 * 1024 * 1024, backupCount=1, encoding=None, delay=0)
    formatter = logging.Formatter('%(asctime)s %(levelname)s %(name)s %(funcName)s(%(lineno)d) %(message)s ')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    logger.debug("Logger initialized.")
    try:
        with open("version", "r") as fp:
            logger.info("ISLAND MANAGER version %s" % fp.read())
    except Exception as e:
        pass



if __name__ == "__main__":
    main()
