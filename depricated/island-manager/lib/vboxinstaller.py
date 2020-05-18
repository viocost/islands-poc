from threading import Thread, Event
from lib.downloader import Downloader as Dl
from lib.exceptions import IslandSetupError
from lib.executor import ShellExecutor as Executor
from lib.exceptions import CmdExecutionError
from lib.util import get_full_path
from shutil import which
from os import path

import sys

if sys.platform == 'linux':
    from os import getuid

import logging
log = logging.getLogger(__name__)

def check_output(func):
    def wrapper(*args, **kwargs):
        res = func(*args, **kwargs)
        if res[0] != 0:
            raise CmdExecutionError(*res)
        return res
    return wrapper

class VBoxInstaller:
    def __init__(self, config,
                 setup,
                 on_message,
                 on_complete,
                 on_error,
                 init_progres_bar,
                 update_progres_bar,
                 on_configuration_in_progress,
                 finalize_progres_bar,
                 update=False):
        self.thread = None
        self.setup = setup
        self.cmd = setup.cmd
        self.config = config
        self.message = on_message
        self.complete = on_complete
        self.error = on_error
        self.init_progres_bar = init_progres_bar
        self.update_progres_bar = update_progres_bar
        self.finalize_progres_bar = finalize_progres_bar
        self.update = update
        self.on_configuration_in_progress = on_configuration_in_progress
        self.path_to_vbox_distr = None
        self.abort = Event()

    def abort_install(self):
        log.debug("Vbox installer: aborting install...")
        self.abort.set()
        
    def start(self):
        self.message("Installing virtualbox...")
        self.thread = Thread(target=self.install)
        self.thread.start()
        log.debug("Thread started")

    def run_setup_command(self, *args, **kwargs):
        res = self.setup.run(args, kwargs)
        if res["error"]:
            self.error(res["result"])
            raise IslandSetupError(res["result"])

    def install(self):
        try:
            if sys.platform == "darwin":
                self.mac_install()
            elif sys.platform == "win32":
                self.win_install()
            elif sys.platform == "linux":
                self.linux_install()
            else:
                raise UnsupportedPlatform("Virtualbox setup: invalid platform name or unsupported platform: %s" % sys.platform)
        except CmdExecutionError as e:
            error_message = "CmdExecutionError.\nReturn code: {retcode}" \
                            "\nstderr: {stderr}" \
                            "\nstdout: {stdout}".format(retcode=e.args[0], stderr=e.args[1], stdout=e.args[2])
            self.error(msg=error_message, size=16)
            log.error("CMD EXECUTION ERROR: %s " %  error_message)
        except Exception as e:
            error_message = "Virtualbox installation didn't successfully finish:\nError: {error} Please try again...".format(error=str(e), size=16)
            self.error(error_message)
            log.error(error_message)
        finally:
            log.debug("Virtualbox installation terminated.")
            self.on_configuration_in_progress(False)

    def mac_install(self):
        log.info("Downloading virtualbox")
        self.init_progres_bar("Downloading virtualbox...")
        # start download
        path_to_vbox_distr = Dl.get(url=self.config["vbox_download"],
                                    dest_path=path.expandvars(self.config["downloads_path"]),
                                    on_update=self.update_progres_bar,
                                    abort=self.abort)
        self.finalize_progres_bar()
        self.message("Download completed. Mounting...")
        log.info("Installing virtualbox")
        if self.abort.is_set():
            log.debug("Vbox intallation aborted.")
            return

        self.on_configuration_in_progress(True)
        self.mount_vbox_distro(path_to_vbox_distr)  # OS SPECIFIC!!!
        if self.update:
            self.uninstall_vbox()
            self.message("Virtualbox old version is uninstalled")
        self.message("Mounted")
        self.message("Installing Virtualbox")
        self._install_vbox_dar_win(path_to_vbox_distr)
        self.message("Installed. Unmounting vbox distro")
        self.unmount_vbox_distro(self.config["vbox_distro_mountpoint"])
        self.message("Unmounted. Removing distro")
        self.delete_vbox_distro(path_to_vbox_distr)
        self.message("Distro removed.")
        self.complete(True, "")

    def win_install(self):
        self.init_progres_bar("Downloading virtualbox...")
        # start download
        path_to_vbox_distr = Dl.get(url=self.config["vbox_download"],
                                    dest_path=path.expandvars(self.config["downloads_path"]),
                                    on_update=self.update_progres_bar,
                                    abort=self.abort)
        self.finalize_progres_bar()
        self.message("Download completed. Installing...")
        self.on_configuration_in_progress(True)
        self._install_vbox_windows(path_to_vbox_distr)
        self.message("Instalation complete!")
        self.complete(True, "")

    def linux_install(self):
        try:
            self._linux_install_download()
            self._linux_install_proceed()
        except Exception as e:
            self.complete(False, str(e))
            log.error("Install error: %s" % str(e))

    def _linux_install_proceed(self):
        """
        Assuming that vbox installer is already downloaded
        :return:
        """
        self.message("Running virtualbox installation script...")
        # Checking whether the installer really exists
        if self.path_to_vbox_distr is None or not path.exists(self.path_to_vbox_distr):
            log.error("Vbox installer not found. Aborting...")
            raise FileNotFoundError("Virtualbox installer not found")
        log.debug("Installer found")
        
        # Checking if user is root
        sudo_command = ""
        if getuid() != 0:
            log.debug("Checking sudo")
            sudo_flavors = ["gksudo", "pkexec", "kdesudo"]
            for f in sudo_flavors:
                if which(f) is not None:
                    sudo_command = f
                    break
            if sudo_command == "":
                raise Exception("Cannot elevate rights. Please restart as root or install virtualbox manually")
        
        log.debug("Adding execute rights to the installer")
        res, stdout, stderr = Executor.exec_sync("chmod +x %s" % self.path_to_vbox_distr)
        if res != 0:
            raise Exception("Unable to add execution rights for the Virtualbox installer.")
        log.debug("VBOX install: all prerequisites checked. Continuing...")
        
        self.message("Installing Virtualbox. This may take a few minutes.")
        cmd = "%s %s" % (sudo_command, self.path_to_vbox_distr)
        res, stdout, stderr = self.install_vbox_linux(cmd)
        self.message(stdout)
        self.complete(True, "Virtualbox installed successfully.")
            
        
    def _linux_install_download(self):
        log.debug("Downloading virtualbox")
        self.init_progres_bar("Downloading virtualbox...")
        self.path_to_vbox_distr = Dl.get(url=self.config["vbox_download"],
                                         dest_path=get_full_path(self.config["downloads_path"]),
                                         on_update=self.update_progres_bar, 
                                         abort=self.abort)
        self.finalize_progres_bar()
        self.message("Download completed. Installing...")

    @check_output
    def mount_vbox_distro(self, path_to_installer):
        return Executor.exec_sync(self.cmd.mount_vbox_distro(path_to_installer))

    @check_output
    def install_vbox_linux(self, cmd):
        return Executor.exec_sync(cmd)
    
    @check_output
    def _install_vbox_dar_win(self, path_to_installer):
        """
        Same procedure for MACOS and windows
        :param path_to_installer:
        :return:
        """
        return Executor.exec_stream(self.cmd.install_vbox(path_to_installer), self.message, self.error)

    def _install_vbox_windows(self, path_to_installer):
        return Executor.run_vbox_installer_windows(self.cmd.install_vbox(path_to_installer))

    @check_output
    def uninstall_vbox(self):
        return Executor.exec_sync(self.cmd.uninstall_vbox())

    @check_output
    def unmount_vbox_distro(self, mountpoint):
        return Executor.exec_sync(self.cmd.unmount_vbox_distro(mountpoint))

    @check_output
    def delete_vbox_distro(self, distrpath):
        return Executor.exec_sync(self.cmd.delete_vbox_distro(distrpath))


class UnsupportedPlatform(Exception):
    pass
