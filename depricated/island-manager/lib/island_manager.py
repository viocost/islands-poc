import re
import time
import os
from threading import Thread
from lib.util import get_full_path, check_output, parse_vminfo_output
from lib.executor import ShellExecutor as Executor
from lib.island_states import IslandStates as States
import logging

log = logging.getLogger(__name__)


class IslandManager:

    def __init__(self, config, commander, setup):
        self.config = config
        self.cmd = commander
        self.setup = setup
        self.ensure_manager_directories_exist()


    def ensure_manager_directories_exist(self):
        if not os.path.exists(get_full_path(self.config["manager_data_folder"])):
            os.makedirs(get_full_path(self.config["manager_data_folder"]))
        if not os.path.exists(get_full_path(self.config["downloads_path"])):
            os.mkdir(get_full_path(self.config["downloads_path"]))
        if not os.path.exists(get_full_path(self.config["user_keys_path"])):
            os.mkdir(get_full_path(self.config["user_keys_path"]))
        if not os.path.exists(get_full_path(self.config["trusted_keys_path"])):
            os.mkdir(get_full_path(self.config["trusted_keys_path"]))

    """ Main API methods """

    def launch_island(self, state_emitter, headless=True, timeout=80):
        def worker():
            if self.setup.is_setup_required():
                state_emitter(States.SETUP_REQUIRED)
                return
            if not self.is_running():
                state_emitter(States.STARTING_UP)
                Executor.exec_sync(self.cmd.start_vm(headless))
                t1 = time.time()
                while not self.is_boot_complete() and (time.time() - t1) < timeout:
                    if self.setup.is_setup_required():
                        state_emitter(States.SETUP_REQUIRED)
                        return
                    time.sleep(4)
                if self.is_running():
                    state_emitter(States.RUNNING)
                elif self.setup.is_setup_required():
                    state_emitter(States.SETUP_REQUIRED)
                else:
                    print("Startup error. VM hasn't started up")
                    state_emitter(States.UNKNOWN)
        t = Thread(target=worker)
        t.start()

    def is_boot_complete(self):
        # Version 1.0.0 check
        return (os.path.exists(self.config.get_stats_path()) and \
            time.time() - os.lstat(self.config.get_stats_path()).st_mtime < 1.5) or \
            Executor.exec_sync(self.cmd.ls_on_guest())[0] == 0 # Version <1.0.0 check

    def stop_island(self, state_emitter, force=False, timeout=60):
        def worker():
            if self.setup.is_setup_required():
                state_emitter(States.SETUP_REQUIRED)
                return
            if self.is_running():
                state_emitter(States.SHUTTING_DOWN)
                Executor.exec_sync(self.cmd.shutdown_vm(force))
            t1 = time.time()
            while self.is_running() and time.time() - t1 < timeout:
                if self.setup.is_setup_required():
                    state_emitter(States.SETUP_REQUIRED)
                    return
                else:
                    time.sleep(4)
            if self.setup.is_setup_required():
                state_emitter(States.SETUP_REQUIRED)
            elif not self.is_running():
                state_emitter(States.NOT_RUNNING)
            elif self.is_running():
                log.debug("ERROR shutting down")
                state_emitter(States.RUNNING)
            else:
                log.error("Fatal error: Island state is unknown")
                state_emitter(States.UNKNOWN)
        t = Thread(target=worker)
        t.start()

    @check_output
    def stop_island_sync(self, force=True):
        return Executor.exec_sync(self.cmd.shutdown_vm(force))

    def restart_island(self, state_emitter, headless=True, timeout=100):
        def worker():
            if self.setup.is_setup_required():
                state_emitter(States.SETUP_REQUIRED)
                return
            state_emitter(States.RESTARTING)
            if self.is_running():
                Executor.exec_sync(self.cmd.shutdown_vm(True))
                time.sleep(1)
            Executor.exec_sync(self.cmd.start_vm(headless))
            t1 = time.time()
            while not self.is_boot_complete() and time.time() - t1 < timeout:
                if self.setup.is_setup_required():
                    state_emitter(States.SETUP_REQUIRED)
                    return
                time.sleep(4)
            if self.is_running():
                state_emitter(States.RUNNING)
            elif self.setup.is_setup_required():
                state_emitter(States.SETUP_REQUIRED)
            else:
                print("Startup error. VM hasn't started up")
                state_emitter(States.UNKNOWN)
        t = Thread(target=worker)
        t.start()

    def is_running(self):
        res = Executor.exec_sync(self.cmd.vminfo())
        log.debug("IS RUNNING RES: %s" % str(res[1]))
        if res[0] != 0:
            return False
        vminfo = parse_vminfo_output(res[1])
        return vminfo["VMState"] == "running"

    def get_vboxmanage_path(self):
        return self.config['vboxmanage']

    def get_vmname(self):
        return self.config['vmname']

    def get_vmid(self):
        return self.config['vmid']

    def emit_islands_current_state(self, state_emitter):
        if self.is_running():
            state_emitter(States.RUNNING)
        else:
            state_emitter(States.NOT_RUNNING)

    def restore_default_df_path(self):
        if self.is_running():
            Executor.exec_sync(self.cmd.shutdown_vm(force=True))
            time.sleep(3)
        Executor.exec_sync(self.cmd.sharedfolder_remove())
        self.config.restore_default("data_folder")
        fullpath = get_full_path(self.config["data_folder"])
        if not os.path.exists(fullpath):
            os.makedirs(fullpath)
        res = Executor.exec_sync(self.cmd.sharedfolder_setup(fullpath))
        if res[0] != 0:
            raise IslandManagerException("Datafolder reset finished with error: %s" % res[2])

    def set_new_datafolder(self, new_path):
        if self.is_running():
            Executor.exec_sync(self.cmd.shutdown_vm(force=True))
            time.sleep(3)
        new_path_full = get_full_path(new_path)
        if not os.path.exists(new_path_full):
            os.makedirs(new_path_full)
        Executor.exec_sync(self.cmd.sharedfolder_remove())
        self.config['data_folder'] = new_path_full
        self.config.save()
        res = Executor.exec_sync(self.cmd.sharedfolder_setup(new_path_full))
        if res[0] != 0:
            raise IslandManagerException("Datafolder setup finished with error: %s" % res[2])


class IslandManagerException(Exception):
    pass
