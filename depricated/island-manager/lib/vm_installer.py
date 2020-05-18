from threading import Thread, Event
from lib.executor import ShellExecutor as Executor
from time import sleep, time
from os import path, makedirs, lstat
from lib.exceptions import IslandsImageNotFound, IslandSetupError, CmdExecutionError
from lib.util import get_full_path, check_output, get_stack
import logging
from lib.image_authoring import ImageAuthoring
from lib.key_manager import KeyManager
from lib.image_verification_error import ImageVerificationError


log = logging.getLogger(__name__)


class VMInstaller:
    def __init__(self,
                 setup,
                 on_message,
                 on_complete,
                 on_error,
                 data_path,
                 init_progres_bar,
                 update_progres_bar,
                 config,
                 on_confirm_required,
                 finalize_progres_bar,
                 file_manager,
                 torrent_manager,
                 island_manager,
                 on_configuration_in_progress,
                 on_download_timeout=None,
                 magnet_link=None,
                 download=False,
                 image_path=None):
        """

        :param setup:
        :param on_message: Handler
        :param on_complete: Handler
        :param on_error: Handler
        :param data_path:
        :param init_progres_bar: Handler
        :param update_progres_bar: Handler
        :param config:
        :param finalize_progres_bar: Handler
        :param download: bool
        :param image_path: path
        """
        log.debug("Initializing VM installer")
        self.thread = None
        self.temp_dir = None
        self.setup = setup
        self.message = on_message
        self.complete = on_complete
        self.error = on_error
        self.island_manager = island_manager
        self.config = config
        self.init_progres_bar = init_progres_bar
        self.update_progres_bar = update_progres_bar
        self.finalize_progres_bar = finalize_progres_bar
        self.download = download
        self.data_path = data_path
        self.image_path = image_path
        self.magnet_link = magnet_link
        self.file_manager = file_manager
        self.torrent_manager = torrent_manager
        self.download_timeout = on_download_timeout
        self.cmd = setup.cmd
        self.on_configuration_in_progress = on_configuration_in_progress
        self.key_manager = KeyManager(self.config)
        self.user_confirmation_required = on_confirm_required
        self.image_authoring = ImageAuthoring(self.config, self.key_manager)
        self.download_initialized = False
        self.abort = Event()

        if not download:
            assert(bool(image_path))
        else:
            assert (bool(magnet_link))

    def abort_install(self):
        log.debug("VM Installer: Aborting install")
        self.abort.set()

    def start(self):
        self.message("Initializing VM installer...")
        log.debug("Launching installer thread")
        self.thread = Thread(target=self.install)
        self.thread.start()

    def prepare_update(self):
        log.debug("Preparing update")
        self.thread = Thread(target=self.update)
        self.thread.start()

    def unknown_key_confirm_resume_update(self):
        log.debug("Resuming update")
        self.thread = Thread(target=self._import_proceed)
        self.thread.start()

    def unknown_key_confirm_resume(self):
        """
        Resumes vm install process after user confirms unknown public key
        This assumes that installer has been initialized before and image is already unpacked
        :return:
        """
        self.thread = Thread(target=self.add_key_continue_import)
        self.thread.start()

    def resume_download(self):
        self.thread = Thread(target=self.download_vm, args=(True, self.abort))
        self.thread.start()

    def abort_download(self):
        self.complete(False, "Image download aborted")

    def install(self):
        log.debug("Installing virtual machine")
        self.message("Installer initialized. ")
        try:
            if self.download:
                self.download_vm(False)
            else:
                # self.message - same function to output on error
                self.launch_vm_import_sequence()
        except CmdExecutionError as e:
            self.emergency_wipe()
            print("CMD execution error: " + str(e))
            error_message = "CmdExecutionError.\nReturn code: {retcode}" \
                            "\nstderr: {stderr}" \
                            "\nstdout: {stdout}".format(retcode=e.args[0], stderr=e.args[1], stdout=e.args[2])
            log.error(error_message)
            log.exception(e)
            self.complete(False, error_message)
        except IslandsImageNotFound as e:
            self.emergency_wipe()
            error_message = "Islands image was not found. Please restart setup."
            log.error(error_message)
            log.exception(e)
            self.complete(False, error_message)
        except Exception as e:
            error_message = "Islands VM installation error: %s" % str(e)
            log.error(error_message)
            log.exception(e)
            self.complete(False, error_message)

    def update(self):
        log.debug("Updating virtual machine")
        try:
            if self.download:
                self.download_vm()
            else:
                self.launch_vm_import_sequence()
        except Exception as e:
            error_message = "Islands VM update error: %s" % str(e)
            log.error(error_message)
            log.exception(e)
            self.complete(False, error_message)

    def _import_proceed(self, add_key=True):
        try:
            if self.abort.is_set():
                log.debug("Abort signal received. Import cancelled")
                return
            self.on_configuration_in_progress(True)
            if add_key:
                self.image_authoring.add_trusted_key(self.temp_dir)
            path_to_image = self.image_authoring.get_path_to_vm_image(self.temp_dir)
            if self.setup.is_islands_vm_exist():
                log.debug("Deleting islands VM")
                self.setup.delete_islands_vm()
                log.debug("Delete successful. Importing new image")
            else:
                log.debug("VM with name %s not found" % self.config["vmname"])
            self.import_vm(path_to_image, self.message, self.error)
            self.configure_vm()
        except Exception as e:
            self.error("Error importing image: %s" % str(e))
            self.complete(False, "Error importing image: %s" % str(e))
        finally:
            self.on_configuration_in_progress(False)

    def download_vm(self, resume=False):
        if not resume:
            log.debug("Image download initialization")
            self.message("Initializing torrent download... This may take a while! ")
        else:
            log.debug("Resuming download...")

        def on_complete(image_path):
            self.finalize_progres_bar()
            self.message(msg="Download completed. Now running setup...", size=16)
            log.info("Image download completed.")
            self.image_path = image_path
            self.launch_vm_import_sequence()


        def on_update(data):
            log.debug(data)
            self.update_progres_bar("%.1f" % (data["progress"]*100), data["total_done"], data["total"], "Downloading islands")

        def on_start_download():
            self.init_progres_bar("Metadata obtained. Starting download: ")
            self.download_initialized = True
            sleep(2)

        self.torrent_manager.download_torrent(magnet=self.magnet_link,
                                              on_complete=on_complete,
                                              on_start_download=on_start_download,
                                              on_timeout=self.download_timeout,
                                              on_update=on_update,
                                              abort_ev=self.abort)

    def launch_vm_import_sequence(self):
        self.temp_dir = self.unpack_image(self.image_path.strip())
        self.message("Verifying Islands image...")
        errors = self.image_authoring.verify_image(self.temp_dir)
        if len(errors) == 0:
            self.message("Success Image verified")
            self._import_proceed(False)
        elif len(errors) == 1 and ImageVerificationError.KEY_NOT_TRUSTED in errors:
            msg = "Warning! Public key is untrusted. Requesting confirmation"
            log.warning(msg)
            self.error(msg)
            self.user_confirmation_required()
        else:
            for error in errors:
                msg = "Verification error: %s" % str(error)
                self.error(msg)
                log.debug(msg)
            log.info("Image verification failed.")
            self.complete(False, "Image verification failed.")

    def add_key_continue_import(self):
        """
        This callback called after user confirms that s/he wants to import the image
        and register untrusted public key as trusted
        It registers public key and imports the image
        :return:
        """
        try:
            self.image_authoring.add_trusted_key(self.temp_dir)
            path_to_image = self.image_authoring.get_path_to_vm_image(self.temp_dir)
            self.import_vm(path_to_image, self.message, self.error)
            self.configure_vm()
        except Exception as e:
            self.error("Error importing image: %s" % str(e))
            self.complete(False)

    def unpack_image(self, path_to_image):
        if not path.exists(path_to_image):
            raise IslandsImageNotFound
        temp_dir = self.file_manager.create_temp_folder()
        self.file_manager.unpack_image_to_temp(temp_dir, path_to_image)
        return temp_dir


    @check_output
    def import_vm(self, path_to_image, on_data, on_error):
        """
        Given path to ova file executes the command that imports the image into VM
        :param path_to_image:
        :param on_data:
        :param on_error:
        :return:
        """
        self.message("Importing virtual appliance..")
        return Executor.exec_stream(self.cmd.import_vm(path_to_image=path_to_image,
                                                       vmname=self.config["vmname"]),
                                    on_data=on_data, on_error=on_error)

    def configure_vm(self):
        log.debug("Configureing imported image")
        try:
            self.message("Image imported. Configuring...")
            log.debug("Image imported. Configuring...")
            self.setup_host_only_adapter()
            log.debug("Network configured..")
            self.message("Network configured..")
            self.island_manager.set_new_datafolder(self.data_path)
            log.debug("Data folder set up... Launching VM")
            self.message("Data folder set up... Launching VM")
            log.info("Setup completed. Restarting Islands...")
            self.message("Setup completed. Restarting Islands...")
            sleep(1)
            self.message("Cleaning up...")
            self.cleanup()
            self.message("Cleanup completed")
            sleep(1)
            self.complete(True)

        except CmdExecutionError as e:
            self.emergency_wipe()
            error_message = "CmdExecutionError.\nReturn code: {retcode}" \
                            "\nstderr: {stderr}" \
                            "\nstdout: {stdout}".format(retcode=e.args[0], stderr=e.args[1], stdout=e.args[2])
            log.error("%s\n%s" % (error_message, get_stack()))
            self.error(msg=error_message, size=16)
            self.complete(False, error_message)

        except IslandsImageNotFound as e:
            self.emergency_wipe()
            error_message = "Islands image was not found. Please restart setup."
            log.error(error_message)
            log.exception(e)
            self.complete(False, error_message)
        except Exception as e:
            self.emergency_wipe()
            error_message = "Islands VM installation error: \n{msg}".format(msg=str(e))
            log.error(error_message)
            log.exception(e)
            self.complete(False, error_message)

    def cleanup(self):
        """
        Removes temp directory
        :return:
        """
        if self.temp_dir:
            self.file_manager.cleanup_temp(self.temp_dir)

    def wait_guest_additions(self):
        for i in range(10):
            # Check version 1.0.0

            if (path.exists(self.config.get_stats_path()) and \
                time() - lstat(self.config.get_stats_path()).st_mtime < 1.5) or \
                Executor.exec_sync(self.cmd.ls_on_guest())[0] == 0:  # Check version < 1.0.0
                    print("Looks like guestcontrol is available on Islands VM! Returning...")
                    return
            print("Awaiting for initial setup to complete..")
            sleep(15)
        raise IslandSetupError("Guest additions installation timed out. Please restart setup")


    @check_output
    def setup_host_only_adapter(self):
        """
        This assumes that VM is already imported
        There is no way to check whether vboxnet0 interface exists,
        so we issue erroneous command to modify it
        if exitcode is 1 - interface doesn't exists, so we create it
        if exitcode is 2 - interface found and we can add it to our VM
        Otherwise there is some other error and we raise it
        """
        res = Executor.exec_sync(self.cmd.hostonly_config())
        if res[0] == 1:
            Executor.exec_sync(self.cmd.hostonly_create())
        elif res[0] != 2:
            raise Exception(res[2])
        """Installing adapter onto vm """
        self.message("Enabling DHCP...")
        Executor.exec_sync(self.cmd.hostonly_enable_dhcp())
        return Executor.exec_sync(self.cmd.hostonly_setup())

    @check_output
    def setup_shared_folder(self, data_folder_path=""):
        fullpath = get_full_path(data_folder_path)
        if not path.exists(fullpath):
            makedirs(fullpath)
        return Executor.exec_sync(self.cmd.sharedfolder_setup(fullpath))

    @check_output
    def start_vm(self, headless=True):
        return Executor.exec_sync(self.cmd.start_vm(headless))

    @check_output
    def insert_guest_additions_image(self):
        return Executor.exec_sync(self.cmd.insert_guest_additions())

    def save_island_ip(self):
        print("Saving island ip")
        island_ip = None
        for _ in range(5):
            island_ip = self.setup.get_islands_ip()
            if island_ip:
                break
            log.debug("Isladns IP hasn't been found. Trying again...")
            sleep(1)
        if not island_ip:
            raise IslandSetupError("Was not able to determine ip address of Islands VM")
        self.config["local_access"] = "<a href='http://{island_ip}:4000'>http://{island_ip}:4000</a>"\
            .format(island_ip=island_ip)
        self.config["local_access_admin"] = "<a href='http://{island_ip}:4000/admin'>Admin access</a>"\
            .format(island_ip=island_ip)
        self.config.save()


    @check_output
    def onvm_get_setup_script(self):
        return Executor.exec_sync(self.cmd.onvm_get_setup_script())

    @check_output
    def onvm_chmodx_install_script(self):
        return Executor.exec_sync(self.cmd.onvm_chmodx_install_script())

    @check_output
    def onvm_launch_setup_script(self):
        def on_data(msg):
            self.message(msg=msg, size=8, color="black")
        return Executor.exec_stream(
            self.cmd.onvm_launch_setup_script(),
            on_data=on_data, on_error=on_data)


    @check_output
    def shutdown_vm(self, force=False):
        return Executor.exec_sync(self.cmd.shutdown_vm(force=force))

    def first_boot(self):
        for i in range(10):
            sleep(3)
            try:
                self.start_vm()
                return
            except CmdExecutionError:
                print("Unsuccessful launch %d" % i )
                continue
        raise Exception("VM launch unsuccessfull")

    def emergency_wipe(self):
        try:
            log.debug("EMERGENCY WIPE!")
            self.shutdown_vm(force=True)
        except Exception as e:
            log.error("Emergency shutdown returned nonzero exit code\nError: %s " % e.args[2])
            log.exception(e)
        finally:
            sleep(3)
        try:
            self.setup.delete_islands_vm()
        except Exception as e:
            log.error("Emergency vm wipe returned nonzero exit code.\nVM deletion error: %s " % e.args[2])
            log.exception(e)
        self.setup.reset_vm_config()
        log.debug("Emergency wipe completed")



