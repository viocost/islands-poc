import unittest
import re
import lib.vendor.libtorrent as lt
from lib.im_config import IMConfig
from lib.island_manager import IslandManager
from lib.island_setup import IslandSetup
from lib.executor import ShellExecutor as Executor
from lib.downloader import Downloader
from lib import util
import logging, sys

class TestConfig(unittest.TestCase):
    def setUp(self):
        # self.config = IMConfig("win32" ,"../", "../", "../os_defaults")
        # self.setup = IslandSetup(self.config)
        # self.island_manager = IslandManager(self.setup)
        logger = logging.getLogger()

        print("Setting logging to debug mode")
        logger.setLevel(logging.DEBUG)
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter('%(asctime)s %(levelname)s %(name)s %(funcName)s(%(lineno)d) %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.debug("Logger initialized.")


    def test_init(self):
        print("Test 1")
        self.config["vmid"] = "12345"
        self.config.save()

    def test_custom(self):
        print("Test 2")
        assert self.config["vmid"] == "12345"

    def test_im_init(self):
        pattern = re.compile(r"^(?=.*vboxmanage)(?=.*Island).+")
        im = IslandManager(self.config)
        a = im.get_command("launch")
        assert re.match(pattern, a)
        print(a)

    def test_stop_cmd(self):
        pattern = re.compile(r"^(?=.*vboxmanage)(?=.*Island).+")

        im = IslandManager(self.config)
        a = im.get_command("stop")
        assert re.match(pattern, a)
        print(a)

    def test_start(self):

        im = IslandManager(self.config)
        respone = im.launch_island()
        print(respone)

    def test_stop(self):

        im = IslandManager(self.config)
        respone = im.stop_island()
        print(respone)

    def test_is_vm_running(self):

        im = IslandManager(self.config)
        r = im.is_running()
        print(r)

    def test_is_vm_running(self):
        im = IslandManager(self.config)
        r = im.stop_island()
        print(r)
        assert(im.is_running() is False)
        im.launch_island()
        assert (im.is_running() is True)

    def test_vbox_download(self):
        self.setup.install_virtualbox()

    def test_setup_vbox_exists(self):
        assert(self.setup.is_vbox_set_up() is True)


    def test_setup_vm_exists(self):
        assert(self.setup.is_islands_vm_exist() )

    def test_grep(self):
        res = Executor.exec("vboxmanage list vms | "
                "grep -c \\\"{vmname}\\\"  ".format(vmname="Island"))
        print(not not res)

    def test_downloadvm(self):
        self.setup.download_vm()

    def test_hostonlysetup(self):
        self.setup.setup_host_only_adapter()

    def test_path_parse(self  ):
        from os import environ
        from lib.island_setup import InvalidPathFormat
        res = self.setup.parse_shared_folder_path("~/islandsData")
        assert res == (environ["HOME"] + "/islandsData/islandsData")
        res = self.setup.parse_shared_folder_path("/Users/kostia/islandsData")
        assert res == ("/Users/kostia/islandsData/islandsData")
        res = self.setup.parse_shared_folder_path("~")
        assert res == (environ["HOME"] + "/islandsData")
        with self.assertRaises(InvalidPathFormat) as context:
             self.setup.parse_shared_folder_path("../blabla")

    def test_sharedfolder_creation(self):
        self.setup.setup_shared_folder("~/islandsData")


    def test_vmcontrol(self):
            # """vboxmanage guestcontrol Island run --exe "/bin/ls" --username root --password islands  --wait-stdout -- ls "/" """
            res = Executor.exec_sync(
                "ls ~/ "
            )
            print("STDOUT PRINT: %s\nRESULT: %d\nERROR: %s" %(res[1], res[0], res[2]))



    def test_ipfetch(self):
        import re
        res = Executor.exec('vboxmanage guestcontrol Island run --exe "/sbin/ip" --username root --password islands  --wait-stdout -- ip a  | grep eth1')
        v = re.search(r'(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)', res).group()
        print("OUTPUT IS %s" % v)

    def test_hash(self):
        print(self.setup.sha1("/Users/konstantin/Downloads/Island.ova"))


    def test_download(self):
        link = self.config['vbox_download']
        Downloader.get(link)
        #res = Executor.exec('curl {link}  -o ~/Downloads/test.dmg'.format(link=self.config['vbox_download']))
        #  print(res)

    def test_safe_exec(self):
        a = Executor.exec_sync('curl {link}  -o ~/Downloads/test.dmg'.format(link=self.config['vbox_download']))
        print(str(a))

    def test_vbox_uninstall(self):
        res = Executor.exec_sync(
            """osascript -e 'do shell script "{mpuntpoint}VirtualBox_Uninstall.tool --unattended" with administrator privileges' """.format(
                mpuntpoint=self.config['vbox_distro_mountpoint'])
        )
        print("done")


    def test_size_formatter(self):
        print(util.sizeof_fmt(123))
        print(util.sizeof_fmt(96123))
        print(util.sizeof_fmt(12344223))
        print(util.sizeof_fmt(1654331453453))

    def test_get_ip(self):
        res = Executor.exec_sync('vboxmanage guestcontrol Island run --exe "/sbin/ip" '
                                 '--username root --password islands  --wait-stdout -- ip a  | grep eth1')
        a =  re.search(r'(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)', res[1]).group()
        print(a)


    def test_vm_setup(self):
        res = Executor.exec_sync(
            """vboxmanage guestcontrol Island run --exe "/usr/bin/wget" --username root --password islands --wait-stdout --wait-stderr -- wget "https://raw.githubusercontent.com/viocost/islands/dev/installer/vbox_full_setup.sh" -O "/root/isetup.sh" """, verbose=True)
        print(Executor.exec_sync(
            """vboxmanage guestcontrol Island run --exe "/bin/chmod" --username root --password islands --wait-stdout --wait-stderr -- chmod +x /root/isetup.sh """, True))


    def test_async_install(self):
        def output(s):
            print("OUTPUT: " + s)
        Executor.exec_stream(
            """vboxmanage guestcontrol Island run --exe "/bin/bash" --username root --password islands --wait-stdout --wait-stderr -- bash /root/isetup.sh -b dev""",
            on_data=output, on_error=output, verbose=True)

    def test_first_boot_start(self):
        from time import sleep

        def start_vm(headless=True):
            headless = " --type headless " if headless else ""
            cmd = "{vboxmanage} startvm Island {headless}".format(vboxmanage=self.config["vboxmanage"],
                                                                  headless=headless)
            return Executor.exec_sync(cmd)

        def first_boot():
            for i in range(10):
                sleep(3)
                try:
                    res = start_vm()
                except Exception as e:
                    print("Unsuccessful launch %d" % i)
                    continue
            raise Exception("VM launch unsuccessfull")
        first_boot()

    def test_image_authoring(self):
        from lib.image_authoring import ImageAuthoring
        author = ImageAuthoring("1.0.0", None)
        version = "1.2.32"
        image_path = "c:\\Users\\Kostia\\Documents\\Island_vm_0.0.101.ova"
        output_path = "c:\\Users\\Kostia\\test"
        output_filename = "offspring.isld"
        publisher="Kostia"
        note="Hello world!"
        key_path = "d:\\2\\A5EA859E23D857C6CFE5A1D154D0C514D653366635D2B44AC95ACAFA5731B5A9\\public.pem"
        key_password = "123QWEasd"
        author.author_image(
            image_version=version,
            islands_version="500.23.44",
            path_to_image=image_path,
            output_path=output_path,
            output_filename=output_filename,
            publisher=publisher,
            note=note,

            key_path=key_path,
            key_password=key_password
        )


    def test_image_verification(self):
        from lib.image_authoring import ImageAuthoring
        image_path = "c:\\Users\\Kostia\\test\\islands_image1\\islands.ova"
        info_path = "c:\\Users\\Kostia\\test\\islands_image1\\info.json"
        sign_path = "c:\\Users\\Kostia\\test\\islands_image1\\info.signature"
        ia = ImageAuthoring("1.0.0", None)
        ia.verify_image(image_path, info_path, sign_path)


    def test_libtorrent_infohash(self):
        magnet = "magnet:?xt=urn:btih:41f2e9ff7752cb5e865e33a79c78de79a6bcf987&dn=offspring.isld"
        info = lt.parse_magnet_uri(magnet)
        infohash = info.info_hash
        stringified = str(infohash)
        print(stringified)
