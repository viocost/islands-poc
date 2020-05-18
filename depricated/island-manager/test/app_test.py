import unittest
from  multiprocessing import Process
from time import sleep

from lib.application import Application

class TestConfig(unittest.TestCase):

    def setUp(self):
        self.app = Application("../default_config.json", "../config.json")
        self.main_window = self.app.main_window
        self.setup = self.app.setup
        self.island_manager = self.app.island_manager
        self.setup_window = self.main_window.setup_window
        self.setup = self.app.setup

    def test_init_app(self):
        app = Process(target=self.app.run, group=None)
        app.start()
        for i in range(10):
            print ("Sleeping %ds." % i)
            sleep(1)
        self.app.kill()




#def test_progress_bar:





    # self.progress_bar_handler(0, "init", "Testing progress bar")
    #
    # for i in range(100):
    #     self.progress_bar_handler(console_index=0, action="update", progress_in_percents=str(i), ratio="%d/100" % i)
    #     sleep()