import qbittorrentapi
from random import randint
from  magnet_parser import  parse
from threading import Thread
from time import sleep
from enum import Enum
import json



class Status(Enum):
    IDLE = 1
    WORKING = 2
    ERROR = 3
    SUCCESS = 4

class Bootstrapper:
    def __init__(self):
        try:
            self.status = Status.IDLE
            self.status_string = ""
            self.error = None
            alpha = "qweryuiopasdfhghzxcvbnm1234567890"
            self.token = "".join([alpha[randint(0, len(alpha)-1)] for _ in range(16)])
            self.qbt = qbittorrentapi.Client(host='localhost:8080', username='admin', password='adminadmin')
            self.qbt.auth_log_in()
        except (qbittorrentapi.LoginFailed, qbittorrentapi.exceptions.APIConnectionError) as e:
            self.set_error(str(e))
            print("Bootstrapper initialization failed")


    def get_status(self):
        return self.status

    def bootstrap(self, magnet):
        def worker():
            try:
                self.set_status(Status.WORKING)
                manifest_magnet = parse(magnet)
                self.qbt.torrents_add(magnet)
                torrents = self.qbt.torrents_info(hashes=manifest_magnet["info_hash"])
                if len(torrents) == 0:
                    raise QBTException("Torrent is not active")

                manifest = torrents[0]
                while manifest.info.progress < 1:
                    msg = "Downloading manifest: %d%%" % int(manifest.info.progress * 100)
                    print(msg)
                    self.set_status_string(msg)
                    sleep(1)
                print("Manifest downloaded. Processing")
                save_path = manifest.save_path
                with open(save_path, "r") as fp:
                    m_data = json.load(fp)


                # find where it is saved
                # get public key
                # verify via script
                # get source magnet
                # download source
                # invoke source install script
                # set status done
            except Exception as e:
                print(e)
                self.set_status(Status.ERROR)
                self.set_error(str(e))
        t = Thread(target=worker)
        t.start()
        print("Worker started")



    def set_status(self, status):
        self.status = status

    def set_status_string(self, string):
        self.status_string = string

    def get_status_string(self):
        return self.status_string

    def set_error(self, msg):
        self.error = msg
        self.status = Status.ERROR

    def is_working(self):
        return self.status  == Status.WORKING


class QBTException(Exception):
    pass
