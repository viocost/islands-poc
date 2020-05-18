import json
import sys

from threading import Thread
import logging
import time
from lib.util import get_full_path, get_stack
from lib.torrent_info import TorrentInfo
import os
import shutil

if sys.platform == 'linux':
    import lib.vendor.linux.libtorrent as lt
elif sys.platform == 'darwin':
    import lib.vendor.darwin.libtorrent as lt
else:
    import lib.vendor.win.libtorrent as lt

log = logging.getLogger(__name__)
TEMP_DIR_NAME_LENGTH = 32
SESSION_DUMP_FILENAME = "ltsession.dump"


class TorrentManager:
    def __init__(self, config):
        log.debug("Initalizing  torrent manager")
        self.config = config
        self.download_rate = 0
        self.upload_rate = 0
        self.upload_rate_limit = 0
        self.download_rate_limit = 0
        self.session = lt.session()
        self.stat = {}
        self.stat_samples = []
        self._alert_processors = self._get_alert_processors()
        self.exiting = False

        if os.path.exists("ltsession.dump"):
            try:
                log.debug("Session dump found. Trying to load session data")
                with open(SESSION_DUMP_FILENAME, "rb") as fp:
                    session_data = lt.bdecode(fp.read())
                    self.session.load_state(session_data)
                    peer_class = self.session.get_peer_class(lt.session.global_peer_class_id)
                    self.download_rate_limit = peer_class["download_limit"]
                    self.upload_rate = peer_class["upload_limit"]

            except Exception as e:
                log.exception(e)
                self.init_new_session()
        else:
            self.init_new_session()

        settings = self.session.get_settings()
        settings["alert_mask"] = 65
        self.session.apply_settings(settings)

        self.save_session_state()
        self.torrents_path = get_full_path(config["downloads_path"])
        self.temp_path = get_full_path(config["temp_path"])
        self.torrent_metadata_path = get_full_path(config["torrent_metadata_path"])
        if not os.path.exists(self.torrent_metadata_path):
            os.mkdir(self.torrent_metadata_path)

        self.stats_update = Thread(target=self._process_alerts)
        self.stats_update.start()
        self.launch_torrents()

    def load_session_params(self):
        peer_class = self.session.get_peer_class(lt.session.global_peer_class_id)
        self.upload_rate_limit = peer_class["upload_limit"]
        self.download_rate_limit = peer_class["download_limit"]
        log.debug("Loading limits up %d b/s, down %d b/s" % (self.upload_rate_limit,  self.download_rate_limit))

    def save_session_state(self):
        try:
            log.debug("Saving session state")
            with open(SESSION_DUMP_FILENAME, "wb") as fp:
                session_data = self.session.save_state()
                fp.write(lt.bencode(session_data))
                log.debug("Session state saved")
        except Exception as e:
            msg = "Error saving session state %s" % str(e)
            log.error(msg)
            log.exception(e)

    def _process_alerts(self):
        while True:
            if self.exiting:
                return
            self.session.post_session_stats()
            time.sleep(.5)
            alerts = self.session.pop_alerts()
            start = time.time()
            while len(alerts) == 0 and time.time() - start < 1:
                alerts = self.session.pop_alerts()
                time.sleep(.1)
            for alert in alerts:
                if type(alert) in self._alert_processors:
                    try:
                        # log.debug("Received lt alert %s. Processing..." % str(type(alert)))
                        self._alert_processors[type(alert)](alert)
                    except Exception as e:
                        log.error("Error processing alert %s: %s\n%s" % (str(type(alert)), str(e), get_stack()))
                        log.exception(e)
                else:
                    # other alerts
                    pass
            time.sleep(1)

    def update_stats(self):
        if len(self.stat_samples) < 2:
            log.debug("Not enough samples to update stats")
            return
        cur_sample, prev_sample = self.stat_samples[0], self.stat_samples[1]
        dt = cur_sample["timestamp"] - prev_sample["timestamp"]
        bytes_uploaded = cur_sample["up"] - prev_sample["up"]
        bytes_downloaded = cur_sample["down"] - prev_sample["down"]
        try:
            self.upload_rate = bytes_uploaded // dt
            self.download_rate = bytes_downloaded // dt
        except ZeroDivisionError as e:
            log.exception(e)

        # log.debug("Bytes uploaded: %d | Rate: %d bytes/s\nBytes downloaded %d | Rate: %d bytes/s " % (
        #     bytes_uploaded, self.upload_rate, bytes_downloaded, self.download_rate
        # ))
        while len(self.stat_samples) > 2:
            self.stat_samples.pop()

    def get_global_download_rate(self):
        return self.download_rate

    def get_global_upload_rate(self):
        return self.upload_rate

    def get_global_download_limit(self):
        return self.download_rate_limit

    def get_global_upload_limit(self):
        return self.upload_rate_limit

    def init_new_session(self):
        self.port_range = self.config["torrent_port_range"][0], self.config["torrent_port_range"][1]
        self.dht_routers = self.config["dht_routers"]
        log.debug("Initializing libtorrent session")
        log.debug("Adding ports")
        self.session.listen_on(*self.port_range)
        log.debug("Adding dht routers")
        for router in self.dht_routers:
            self.session.add_dht_router(*router)
        self.session.add_dht_router("127.0.0.1", 6881)
        log.debug("Starting dht")
        self.session.start_dht()

    def save_torrent_info(self, at_params, magnet, status="active", save_path=None):
        """
        Saves torrent info in JSON file.
        If file already exists - it will be overwritten
        :param at_params: libtorrent add_torrent_params object
        :param magnet: str Magnet link
        :param status: status to assign to torrent
        :param save_path: Save path
        :return:
        """
        log.debug("Saving torrent info %s" % magnet)
        ti = lt.parse_magnet_uri(magnet)
        #infohash = str(at_params.ti.info_hash)
        infohash = str(ti.info_hash)
        torrent_dir = None
        torrent_path = None
        if save_path:
            torrent_path = save_path
            torrent_dir = os.path.dirname(save_path)
        else:
            torrent_dir = os.path.join(self.torrents_path, infohash)
            torrent_path = os.path.join(torrent_dir, at_params.name)
        filepath = os.path.join(self.torrent_metadata_path, ("%s.json" % infohash))
        log.debug("Initializing TorrentInfo object %s " % magnet)
        info = TorrentInfo.from_dict({
            "infohash": infohash,
            "magnet": magnet,
            "torrent_directory": torrent_dir,
            "name": at_params.name,
            "full_path": torrent_path,
            "status": status
        })
        log.debug("Done. Writing to file...")
        self._write_torrent_info_data(filepath, info.dump())
        log.debug("Torrent info saved")

    def _write_torrent_info_data(self, filepath, data):
        """
        Writes torrent info data to file
        :param filepath: string full path to info file
        :param data: dict with torrent info
        :return:
        """
        with open(filepath, "w") as fp:
            json.dump(data, fp)

    def set_global_upload_limit(self, bytes_per_sec=0):
        log.debug("Setting global upload limit: %d b/s" % bytes_per_sec)
        peer_class = self.session.get_peer_class(lt.session.global_peer_class_id)
        peer_class["upload_limit"] = bytes_per_sec
        self.session.set_peer_class(lt.session.global_peer_class_id, peer_class)
        self.save_session_state()
        self.upload_rate_limit = peer_class["upload_limit"]

    def set_global_download_limit(self, bytes_per_sec=0):
        log.debug("Setting global download limit: %d b/s" % bytes_per_sec)
        peer_class = self.session.get_peer_class(lt.session.global_peer_class_id)
        peer_class["download_limit"] = bytes_per_sec
        self.session.set_peer_class(lt.session.global_peer_class_id, peer_class)
        self.save_session_state()
        self.download_rate_limit = peer_class["download_limit"]

    def delete_torrent(self, infohash, with_files=False):
        log.debug("Deleting torrent %s" % str(with_files))
        info = self.get_torrent_info(infohash)
        t_info = lt.parse_magnet_uri(info["magnet"])
        handle = self.session.find_torrent(t_info.info_hash)
        if handle.is_valid():
            self.session.remove_torrent(handle, with_files)
        info_path = self._get_torrent_info_path(infohash)
        torrent_file_path = os.path.join(self.torrent_metadata_path, "%s.torrent" % infohash)
        files_path = os.path.join(self.torrents_path, infohash)
        time.sleep(.7)
        if os.path.exists(info_path):
            os.remove(info_path)
        if os.path.exists(torrent_file_path):
            os.remove(torrent_file_path)
        if os.path.isdir(files_path) and with_files:
            shutil.rmtree(files_path)
        if os.path.exists(info["full_path"]) and with_files:
            if os.path.isdir(info["full_path"]):
                shutil.rmtree(info["full_path"])
            else:
                os.remove(info["full_path"])
        log.debug("Delete torrent successful")

    def pause_torrent(self, infohash):
        log.debug("Pausing torrent %s" % infohash)
        info = self.get_torrent_info(infohash)
        lt_info = lt.parse_magnet_uri(info["magnet"])
        handle = self.session.find_torrent(lt_info.info_hash)
        if handle.is_valid():
            handle.pause()
            ti = TorrentInfo.from_dict(self.get_torrent_info(infohash))
            ti["status"] = "pause"
            self._write_torrent_info_data(self._get_torrent_info_path(infohash), ti.dump())
        else:
            log.exception("%s\n%s" % ("Erro pausing torrent: handle is invalid!", get_stack()))



    def resume_torrent(self, infohash):
        log.debug("Pausing torrent %s" % infohash)
        info = self.get_torrent_info(infohash)
        lt_info = lt.parse_magnet_uri(info["magnet"])
        handle = self.session.find_torrent(lt_info.info_hash)
        if handle.is_valid():
            handle.resume()
            ti = TorrentInfo.from_dict(self.get_torrent_info(infohash))
            ti["status"] = "active"
            self._write_torrent_info_data(self._get_torrent_info_path(infohash), ti.dump())
        else:
            log.exception("Error pausing torrent: handle is invalid! %s " % get_stack())

    def get_torrent_info(self, infohash):
        """
        Loads torrent info into dictionary and returns it
        :param infohash: string
        :return: torrent info string
        """
        t_info_path = os.path.join(self.torrent_metadata_path, ("%s.json" % infohash))
        if not os.path.exists(t_info_path):
            msg = "Torrent info file not found \n%s" % get_stack()
            log.exception(msg)
            raise FileNotFoundError(msg)
        with open(t_info_path, "r") as fp:
            return json.load(fp)

    def get_magnet_link(self, infohash):
        """
        Given infohash as string returns magnet link
        :param infohash:
        :return:
        """
        torrent_info = self.get_torrent_info(infohash)
        return torrent_info["magnet"]



    def _get_torrent_info_path(self, infohash):
        return os.path.join(self.torrent_metadata_path, ("%s.json" % infohash))

    def launch_torrents(self):
        log.debug("Launching existing torrents.")
        for filename in filter(lambda f: f.endswith(".json"), os.listdir(self.torrent_metadata_path)):
            filepath = os.path.join(self.torrent_metadata_path, filename)
            if os.path.isdir(filepath):
                log.warning("Invalid entry in torrent metadata directory: %s" % filename)
            with open(filepath, "r") as fp:
                try:
                    data = json.load(fp)
                    self._launch_torrent(data)
                except json.decoder.JSONDecodeError as e:
                    log.debug("JSON decode error in %s: %s" % (filepath, str(e)))

    def begin_torrent_download(self, magnet):
        add_torrent_params = lt.parse_magnet_uri(magnet)
        handle = self.session.find_torrent(add_torrent_params.info_hash)
        if handle.is_valid():
            log.debug("Torrent already exists: %s" % add_torrent_params.info_hash)
            return
        t_path = os.path.join(self.torrents_path, str(add_torrent_params.info_hash))
        if not os.path.exists(t_path):
            os.mkdir(t_path)
        add_torrent_params.save_path = t_path
        self.save_torrent_info(add_torrent_params, magnet, "active")
        self._add_torrent(add_torrent_params)

    def _launch_torrent(self, data):
        """
        Given torrent data adds torrent to current libtorrent session
        :param data: dict
        :return:
        """

        # if data["status"] == "pause":
        #     log.debug("Torrent %s is on pause. Skipping" % data["infohash"])
        #     return

        add_torrent_params = None
        log.debug("Launching torrent %s" % data["infohash"])
        if self.is_torrent_file_exist(data["infohash"]):
            log.debug("Loading info from torrent file")
            lt_info = lt.torrent_info(os.path.join(self.torrent_metadata_path, ("%s.torrent" % data["infohash"])))
            add_torrent_params = lt.add_torrent_params()
            add_torrent_params.ti = lt_info
        else:
            log.debug("Adding torrent with infohash only")
            add_torrent_params = lt.parse_magnet_uri(data["magnet"])
        add_torrent_params.save_path = data["torrent_directory"]
        infohash = add_torrent_params.info_hash
        handle = self.session.find_torrent(infohash)
        if handle.is_valid():
            log.debug("Torrent already present in session: %s" % data["infohash"])
            return
        self._add_torrent(add_torrent_params)

    def is_torrent_file_exist(self, infohash):
        return os.path.exists(os.path.join(self.torrent_metadata_path, ("%s.torrent" % infohash)))

    def _download_existing_torrent(self, handle, infohash, on_complete, on_start_download, on_update=None, abort_ev=None, on_timeout=None):
        log.debug("downloading previously added torrent")
        status = handle.status()

        if status.is_seeding:
            log.debug("Torrent already seeding. Returning handle...")
            # get full path
            data = TorrentInfo.from_dict(self.get_torrent_info(str(infohash)))
            on_complete(data["full_path"])
        elif status.state == lt.torrent_status.downloading_metadata:
            log.debug("Torrent is awaiting download")

            self.await_download_start(handle, on_start_download, abort_ev, on_timeout)
            self.await_download_completion(handle, on_complete, on_update, abort_ev, on_timeout)
            return

        else:
            log.debug("Torrent is already downloading. Awaiting...")
            self.await_download_completion(handle, on_complete, on_update, abort_ev, on_timeout)
            return

    def download_torrent(self, magnet, on_complete, on_start_download, on_timeout, on_update=None, abort_ev=None):
        """
        Downloads torrent by given magnet URI and calls callbacks when download process changes state
        This method is created to be used in the interactive forms, when user will wait for download to complete
        Callbacks are used to let the user know about download state changes and any appearing problems.
        :param magnet: Magnet URI
        :param on_complete: callback when download is 100% completed
        :param on_start_download: callback, once metadata is obtained and download started
        :param on_timeout: callback in the event of timeout. It will be called if average download speed
                    falls bellow the threshold
        :param on_update: callback called on every libtorrent status poll. By default it happens every second.
        :param abort_ev: if true - download will return immediately
        :return: none
        """
        # Parse magnet
        log.debug("Torrent download request on timeout: %s abort_ev: %s" % (str(on_timeout), str(abort_ev)))
        add_torrent_params = lt.parse_magnet_uri(magnet)


        # extract infohash
        infohash = add_torrent_params.info_hash
        handle = self.session.find_torrent(infohash)
        if handle.is_valid():
            log.debug("Torrent exists in the current session")
            self._download_existing_torrent(handle, infohash, on_complete, on_start_download, on_update, abort_ev, on_timeout)
            return
        log.debug("Adding torrent %s" % magnet)
        t_path = os.path.join(self.torrents_path, str(infohash))
        if not os.path.exists(t_path):
            os.mkdir(t_path)
        add_torrent_params.save_path = t_path
        self.save_torrent_info(add_torrent_params, magnet, "active")
        handle = self._add_torrent(add_torrent_params)
        self.await_download_start(handle=handle,
                                  on_download_started=on_start_download,
                                  abort_ev=abort_ev,
                                  on_timeout=on_timeout)
        self.await_download_completion(handle=handle,
                                       on_complete=on_complete,
                                       on_update=on_update,
                                       abort_ev=abort_ev,
                                       on_timeout=on_timeout)


    def await_download_start(self, handle, on_download_started, abort_ev=None, on_timeout= None, poll_timeout=1):
        log.debug("Awaiting torrent download... abort_ev: %s" % str(abort_ev))

        status = handle.status()
        start = time.time()
        while status.state not in [lt.torrent_status.downloading,
                                   lt.torrent_status.finished,
                                   lt.torrent_status.seeding]:
            if abort_ev and abort_ev.is_set():
                log.debug("await_download_start: download aborted. exiting.. ")
                return
            status = handle.status()

            log.debug("Awaiting metadata... State: %s" % str(status.state))
            log.debug("on_timeout: %s | dt: %f" % (str(on_timeout), time.time() - start))
            if time.time() - start > 30 and on_timeout:
                log.debug("Metadata await timeout.")
                on_timeout()
            time.sleep(poll_timeout)
        on_download_started()

    def await_download_completion(self, handle, on_complete, on_update=None, abort_ev=None, on_timeout=None, poll_timeout=1):

        log.debug("Awaiting download completion.. abort_ev: %s" % str(abort_ev))
        if abort_ev and abort_ev.is_set():
            log.debug("Abort event is set returning...")
            return
        log.debug("Awaiting torrent for torrent download to finish")
        status = handle.status()
        start = time.time()
        progress = status.progress
        epsilon = 30 * 1024  # minimal acceptable bitrate (bytes/sec)
        while not status.is_seeding:
            if abort_ev and abort_ev.is_set():
                log.debug("await_download_completion: Install aborted. exiting.. ")
                return
            status = handle.status()
            if on_update:
                on_update({
                    "progress": status.progress,
                    "num_seeds": status.num_seeds,
                    "num_peers": status.num_peers,
                    "state": status.state,
                    "info_hash": status.info_hash,
                    "total": status.total_wanted,
                    "total_done": status.total_done,
                })

            log.debug('\r%.2f%% complete (down: %.1f kB/s up: %.1f kB/s peers: %d) %s' % (
                status.progress * 100, status.download_rate / 1000, status.upload_rate / 1000,
                status.num_peers, status.state))
            alerts = self.session.pop_alerts()
            for a in alerts:
                if a.category() & lt.alert.category_t.error_notification:
                    log.warning(a)
            time.sleep(poll_timeout)

            dt_time = time.time() - start
            if dt_time > 40:
                average_bitrate_per_second = (status.progress - progress) * status.total_wanted / dt_time
                if average_bitrate_per_second < epsilon and on_timeout:
                    log.debug("Torrent download timeout")
                    on_timeout()
                else:
                    progress = status.progress
                    start = time.time()

        log.debug("Download completed. \nName: %s\nPath: %s" % (status.name, status.save_path))
        infohash = str(status.info_hash)
        data = TorrentInfo.from_dict(self.get_torrent_info(infohash))
        on_complete(data["full_path"])

    def get_torrents_data(self):
        return [{
            "infohash": ts.info_hash,
            "name": ts.name,
            "total": ts.total_wanted,
            "total_done": ts.total_done,
            "state": ts.state,
            "paused": ts.paused,
            "progress": ts.progress}
                for ts in [t.status() for t in self.session.get_torrents()]]

    def get_save_path(self, infohash):
        info = self.get_torrent_info(infohash)
        lt_info = lt.parse_magnet_uri(info["magnet"])
        handle = self.session.find_torrent(lt_info.info_hash)
        if handle.is_valid():
            status = handle.status()
            log.debug("LT save path %s" % status.save_path)
            log.debug("save path %s" % info["torrent_directory"])
            return status.save_path

    def _get_torrents(self):
        return self.session.get_torrents()

    def get_torrent(self, infohash):
        return self.session.get_torrent(infohash)

    def _add_torrent(self, params):
        """
        Adds toreent to the session and returns torrent handle
        :param params: must be libtorrent add_torrent_params object
        :return: torrent handle
        """
        handle = self.session.add_torrent(params)
        self.save_session_state()
        return handle

    def create_torrent(self, path_to_payload, add_to_session=True):
        log.debug("Creating torrent for %s" % path_to_payload)
        if not os.path.exists(path_to_payload):
            raise FileNotFoundError("Path to data is invalid")
        storage = lt.file_storage()
        lt.add_files(storage, path_to_payload)
        ct = lt.create_torrent(storage) # ct - create torrent object
        ct.add_node("127.0.0.1", 6881)
        lt.set_piece_hashes(ct, os.path.dirname(path_to_payload))

        entry = ct.generate()
        if entry is None:
            log.exception("%s\n%s" % ("Torrent create failed: bencode entry is undefined.", get_stack()))
            raise TorrentCreateError
        t_info = lt.torrent_info(entry)
        #t_info.save_path = path_to_payload
        magnet = lt.make_magnet_uri(t_info)
        atp = lt.add_torrent_params()
        atp.ti = t_info
        infohash = str(t_info.info_hash())
        atp.info_hash = t_info.info_hash()
        atp.save_path = os.path.dirname(path_to_payload)
        atp.name = entry[b"info"][b"name"]
        if add_to_session:
            log.debug("Adding new torrent to session")
            handle = self._add_torrent(atp)
            handle.force_recheck()
        self.save_torrent_info(atp, magnet, "active", path_to_payload)
        with open(os.path.join(self.torrent_metadata_path, "%s.torrent" % str(infohash)), "wb") as fp:
            fp.write(lt.bencode(entry))
        log.debug("Torrent created successfully")



    def _get_alert_processors(self):
        """
        :return: Dictionary of supported libtorrent alert handlers where key - libtorrent alert type and value - handler
        """
        return {
            lt.metadata_received_alert: self.proc_metadata_received,
            lt.session_stats_alert: self.proc_session_stats,
            lt.torrent_checked_alert: self.proc_torrent_check_alert
        }

    def proc_torrent_check_alert(self, alert):
        log.debug("Torrent check alert message: %s"  % alert.message())

    def proc_session_stats(self, alert):
        t = time.time()
        sample = {
            "timestamp": t,
            "up": alert.values["net.sent_payload_bytes"],
            "down": alert.values["net.recv_payload_bytes"]
        }
        self.stat_samples.insert(0, sample)
        self.update_stats()

    def proc_metadata_received(self, alert):
        t_handle = alert.handle
        if not t_handle.is_valid():
            log.exception("%s\n%s" % ("Error saving metadata. Handle is invalid.", get_stack()))
            return
        log.debug("Metadata received! Saving metadata...")
        t_info = t_handle.torrent_file()
        c_torrent = lt.create_torrent(t_info)
        entry = c_torrent.generate()
        infohash = t_info.info_hash()
        with open(os.path.join(self.torrent_metadata_path, "%s.torrent" % str(infohash)), "wb") as fp:
            fp.write(lt.bencode(entry))

    def stop_session(self):
        self.exiting = True
        self.stats_update.join()
        self.save_session_state()


class TorrentCreateError(Exception):
    pass
