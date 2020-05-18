import os
import json
import logging
import shutil

from lib.util import get_full_path

log = logging.getLogger(__name__)

DEFAULT_CONFIG = "default_config.json"

OS_SPECIFIC_DEFAULTS={
    "darwin": "mac.json",
    "win32": "windows.json",
    "linux": "linux.json"
}

CUSTOM_CONFIG_LINK = "custom_config_link"


CUSTOM_CONFIG = "config.json"


class IMConfig:
    def __init__(self, platform, os_defaults_path="os_defaults/"):
        """
        :param platform:
        :param default_config_path:  platform independent defaults
        :param config_path:  custom config
        :param os_defaults_path: platform dependent defaults
        """
        self.__default = self.__get_default()
        self.load_os_specific_defaults(platform, os_defaults_path)
        self.custom_config_link = self.get_custom_config_link()
        self.__custom = self.load_custom()

    def save(self):
        with open(self.custom_config_link, "w") as f:
            json.dump(self.__custom, f)

    def __getitem__(self, item):
        if item == CUSTOM_CONFIG_LINK:
            return self.custom_config_link
        result = self.__custom.get(item) or self.__default.get(item)
        if result is not None:
            return result
        raise KeyError

    def __setitem__(self, key, value):
        if key == CUSTOM_CONFIG_LINK:
            self.set_cofig_link(value)
            return

        if key in self.__default:
            self.__custom[key] = value
        else:
            raise KeyError

    def __contains__(self, item):
        if item == CUSTOM_CONFIG_LINK:
            return True
        else:
            return item in self.__custom or item in self.__default

    def load_custom(self):
        custom_conf_path = self.get_custom_config_link()
        if not os.path.exists(custom_conf_path):
            self.reset_custom_config_link()
        with open(custom_conf_path, "r") as fp:
            return json.load(fp)

    def __load(self, file_path):
        if not os.path.exists(file_path):
            raise FileNotFoundError
        with open(file_path, "r") as fp:
            return json.load(fp)

    def restore_default(self, key=None):
        if key:
            if key not in self.__default:
                raise KeyError("Non-existent config property %s" % key)
            if key in self.__custom:
                del self.__custom[key]
        else:
            self.__custom = {}
        self.save()

    def __get_default(self):
        if os.path.exists(DEFAULT_CONFIG):
            with open(DEFAULT_CONFIG) as f:
                return json.load(f)
        else:
            raise MissingDefaultConfig("Attempt to open: %s" % DEFAULT_CONFIG)

    def load_os_specific_defaults(self, platform, os_defaults_path):
        if platform not in OS_SPECIFIC_DEFAULTS:
            raise KeyError("Invalid OS name or unsupported OS")
        with open("".join((os_defaults_path, OS_SPECIFIC_DEFAULTS[platform])), "r") as f:
            self.__default.update(json.load(f))

    def is_default(self, key):
        if key not in self.__default:
            raise KeyError("Non-existent config property %s" % key)
        return key not in self.__custom

    def set_cofig_link(self, path_):
        """
        Path to custom config file is kept in separate file in the program's root directory
        as a string.
        it also checks if path_ exists and raises an exception if not
        :param path_: path to custom config file. If it is None - the link will be set to default: data_dir/CUSTOM-CONFIG
        :return:
        """
        if not os.path.exists(path_):
                log.error("Error setting custom cofig link: custom config file does not exist")
                raise SetConfigLinkError("Custom config file does not exist")

        with open (CUSTOM_CONFIG_LINK, "w") as fp:
            log.debug("Setting custom config link to %s" % path_)
            fp.write(path_)
            self.custom_config_link = path_

    def get_custom_config_link(self):
        log.debug("Loading custom config link")
        self.validate_custom_config_link()
        with open(CUSTOM_CONFIG_LINK, "r") as fp:
            return fp.read().strip()

    def reset_custom_config_link(self):
        log.debug("Resetting custom config link")
        self.ensure_default_data_folder_exists()
        custom_config_default_path = self.get_custom_config_default_path()
        if not os.path.exists(custom_config_default_path):
            with open(custom_config_default_path, "w") as fp:
                json.dump(dict(), fp)
        with open(CUSTOM_CONFIG_LINK, "w")  as fp:
            fp.write(custom_config_default_path)
        self.custom_config_link = custom_config_default_path

    def validate_custom_config_link(self):
        log.debug("Validating custom config link")
        link_data = None
        if os.path.exists(CUSTOM_CONFIG_LINK):
            log.debug("Config link file found!")
            with open(CUSTOM_CONFIG_LINK, "r") as fp:
                link_data = fp.read().strip()
        if link_data is None or not os.path.exists(link_data):
            log.debug("Config link file not found or link is invalid. Resetting...")
            self.reset_custom_config_link()           

    def get_custom_config_default_path(self):
        return get_full_path(os.path.join(self.__default["manager_data_folder"], CUSTOM_CONFIG))

    def ensure_default_data_folder_exists(self):
        default_data_dir_path = get_full_path(self.__default["manager_data_folder"])
        if not os.path.exists(default_data_dir_path):
            os.makedirs(default_data_dir_path)

    def get_stats_path(self):
        return get_full_path(os.path.join(self["data_folder"], self["stats"]))





class SetConfigLinkError(Exception):
    pass

class MissingDefaultConfig(Exception):
    pass
