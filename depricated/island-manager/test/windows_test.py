import unittest
from lib.im_config import IMConfig
from commander import Commander as Cmd
from lib.downloader import Downloader as dl
from os import path
import re
from lib.executor import ShellExecutor as Exec


class TestConfig(unittest.TestCase):

    def test_commander(self):
        c = IMConfig("win32", "../", "../", "../os_defaults/")
        cmd = Cmd(c, "win32  ")
        assert(cmd.start_vm() == "%PROGRAMFILES%\\Oracle\VirtualBox\\vboxmanage.exe startvm Island --type headless")

    def test_download(self):
        r = dl.get("https://sourceforge.net/projects/islands-image/files/Islands_vm_v0.0.011.ova/download", path.expandvars("%USERPROFILE%\\Downloads\\"))
        print(r)

    def test_config(self):
        c = IMConfig("win32", "../", "../", "../os_defaults/")
        cmd = Cmd(c)
        command = cmd.ip_a_eth1_onguest()
        res = Exec.exec_sync(command)
        response = [line for line in res[1].split("\n") if "eth1" in line]
        for line in response:
            search_res = re.search(r'(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)', line)
            if search_res:
                ip =  search_res.group()
                print (ip)
