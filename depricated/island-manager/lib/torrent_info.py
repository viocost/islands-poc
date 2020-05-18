import logging

log = logging.getLogger(__name__)


class TorrentInfo:
    TORRENT_STATUS = {
        "active": 1,
        "pause": 2,
        "error": 3
    }

    def __init__(self):
        self.__data = {
            "infohash": None,
            "magnet": None,
            "torrent_directory": None,
            "name": None,
            "full_path": None,
            "status": None,
        }

    def __getitem__(self, item):
        if item not in self.__data:
            raise KeyError("Invalid torrent info property")
        return self.__data[item]

    def __setitem__(self, key, value):
        if key not in self.__data:
            raise KeyError("Invalid torrent info property")
        elif key == "status" and value not in TorrentInfo.TORRENT_STATUS:
            log.error("Status value %s is invalid" % value)
            raise InvalidTorrentStatusError
        self.__data[key] = value

    def __contains__(self, item):
        return item in self.__data

    def get_keys(self):
        return self.__data.keys()

    @staticmethod
    def from_dict(dict_info):
        log.debug("Parsing torrent info: %s " % str(dict_info))
        info = TorrentInfo()
        keys = info.get_keys()
        for key in keys:
            if key not in dict_info:
                raise InfoParseError
            info[key] = dict_info[key]
        log.debug("Object parsed...")
        return info

    def dump(self):
        return self.__data


class InfoParseError(Exception):
    pass


class InvalidTorrentStatusError(Exception):
    pass
