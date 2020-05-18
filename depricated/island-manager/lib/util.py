import os, sys
from lib.exceptions import CmdExecutionError, InvalidPlatformError
from PyQt5.QtWidgets import QMessageBox
import logging
import traceback
import re
from lib.app_ref import AppRef

log = logging.getLogger(__name__)

if sys.platform == "win32":
    import ctypes


def get_screen_resolution():
    app = AppRef.get_app()
    return app.desktop().screenGeometry()


def adjust_window_size(wgt):
    log.debug("Adjusting size...")
    curr_size = wgt.size()
    screen_res = get_screen_resolution()
    adjusted_h = min(curr_size.height(), screen_res.height())
    adjusted_w = min(curr_size.width(), screen_res.width())
    wgt.resize(adjusted_w, adjusted_h)


def sizeof_fmt(num, suffix='b'):
    num = int(num)
    for unit in ['','k','m','g','t','p','e','z']:
        if abs(num) < 1024.0:
            return "%3.1f %s%s" % (num, unit, suffix)
        num /= 1024.0
    return "%.1f %s%s" % (num, 'Yi', suffix)


def is_file_exist(path):
    full_path = get_full_path(path)
    return os.path.isfile(full_path)


def get_full_path(path):
    return os.path.expandvars(os.path.expanduser(path))


def get_version():
    with open("version", "r") as vfile:
        return re.sub("\r?\n", "", vfile.readline())


def get_current_path():
    print(os.getcwd())

def has_admin_rights_win32():
    if sys.platform != "win32":
        raise InvalidPlatformError("Attempt to check windows admin privileges on non-windows platform")
    return ctypes.windll.shell32.IsUserAnAdmin() != 0


def read_file_in_chunks(file_obj, chunk_size=262144):
    while True:
        data = file_obj.read(chunk_size)
        if not data:
            break
        yield data


def check_output(func):
    def wrapper(*args, **kwargs):
        res = func(*args, **kwargs)
        if res[0] != 0:
            log.debug("STDOUT: %s " % str(res[1]))
            log.debug("STDERR: %s " % str(res[2]))
            raise CmdExecutionError(*res)
        return res
    return wrapper


def show_user_error_window(parent, message):
    msgBox = QMessageBox(parent)
    msgBox.setIcon(QMessageBox.Warning)
    msgBox.setText("Error")
    msgBox.setInformativeText(message)
    msgBox.setDefaultButton(QMessageBox.Ok)
    msgBox.exec()


def show_notification(parent, text):
    log.debug("About to show notifiction: %s" % text)
    QMessageBox.warning(parent, "Warning", text, buttons=QMessageBox.Ok)

def get_stack():
    return "".join(traceback.format_stack())


def parse_vminfo_output(raw_stdout):
    """
    given raw output of vboxmanage showvminfo command
    returns parsed dictionary
    :param raw_stdout:
    :return:
    """
    lines = [re.split("=", line) for line in re.split(r"\r?\n",  raw_stdout)]
    try:
        res = dict()
        for line in lines:
            if len(line) > 1:
                res[line[0]] = line[1].strip("\"\'")
        return res
    except Exception as e:
        print(e)
        raise e


def parse_vm_properties(raw_stdout):
    """
    given raw output of vboxmanage showvminfo command
    returns parsed dictionary
    :param raw_stdout:
    :return:
    """
    res = dict()
    for line in re.split("\r?\n", raw_stdout):
        data = line.split(", ")
        if len(data) > 1:
            try:
                name = re.search(r"(?<=Name: ).*", data[0])
                val = re.search(r"(?<=value: ).*", data[1])
                if all((name, val)):
                    res[name.group(0)] = val.group(0)
            except Exception as e:
                continue
    return res


def is_subdir(subdir_candidate, dir):
    pass

def is_admin_registered(datadir):
    datadir = get_full_path(datadir)
    keys_path = os.path.join(datadir, "keys")
    vaults_path = os.path.join(datadir, "vaults")
    if os.path.exists(keys_path) and os.path.exists(vaults_path):
        res = len(os.listdir(keys_path)) > 0
        return res and len(list(filter(lambda x: os.path.isdir(os.path.join(vaults_path, x)), os.listdir(vaults_path))))





