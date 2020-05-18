import random
import os
import string
import logging
import zipfile
from lib.util import get_full_path
from shutil import rmtree

log = logging.getLogger(__name__)


class FileManager:
    def __init__(self, config):
        self.temp_path = get_full_path(config["temp_path"])
        self.temp_dir_name_length = config["temp_dir_name_length"]
        if not os.path.exists(self.temp_path):
            os.mkdir(self.temp_path)


    def create_temp_folder(self):
        log.debug("Creating temp folder")
        name = ''.join(random.SystemRandom().choice(string.ascii_uppercase + string.digits) \
                       for _ in range(self.temp_dir_name_length))
        temp_path = os.path.join(self.temp_path, name)
        os.mkdir(temp_path)
        return temp_path

    def unpack_image_to_temp(self, temp_dir,  imagefile):
        log.debug("Unpacking file to temporary directory")
        with zipfile.ZipFile(imagefile, 'r') as fp:
            fp.extractall(temp_dir)
        log.debug("Unzipping completed...")

    def cleanup_temp(self, temp_path):
        log.debug("Cleaning up path: %s" % temp_path)
        if os.path.exists(temp_path):
            rmtree(temp_path)
            log.debug("Temp dir removed")

if __name__ == '__main__':
    p = "c:\\Users\\Kostia\\test\\"
    f = "c:\\Users\\Kostia\\test\\offspring.isld"
    c = {
        "temp_path": p,
        "temp_dir_name_length": 32
    }
    fm = FileManager(c)
    name = fm.create_temp_folder()
    print(name)
    #fm.unpack_image_to_temp(f)
