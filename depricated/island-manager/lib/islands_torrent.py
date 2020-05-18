"""
Wrapper around libtorrent
"""

import lib.libtorrent as lt
import time
import logging

log = logging.getLogger(__name__)


class IslandsTorrent:
    def __init__(self, save_path):
        self.save_path = save_path
        PORT_RANGE = (6881, 6891)
        self.session = lt.session({'listen_interfaces': '0.0.0.0:6881'})
        self.session.listen_on(PORT_RANGE[0], PORT_RANGE[1])
        self.session.add_dht_router("router.utorrent.com", 6881)
        self.session.add_dht_router("router.bittorrent.com", 6881)
        self.session.add_dht_router("dht.transmissionbt.com", 6881)
        self.session.add_dht_router("router.bitcomet.com", 6881)
        self.session.add_dht_router("dht.aelitis.com", 6881)
        self.session.add_dht_router('127.0.0.1', 6881)
        self.session.start_dht()

    def seed_island(self):
        """
        Starts seeding saved islands images
        :return:
        """
        pass

    async def download_by_magnet_async(self, magnet, save_path = None):
        info = lt.parse_magnet_uri(magnet)
        torrent_handle = self.session.add_torrent(info)
        status = torrent_handle.status()
        while not status.is_seeding:
            status = torrent_handle.status()

            print('\r%.2f%% complete (down: %.1f kB/s up: %.1f kB/s peers: %d) %s' % (
                status.progress * 100, status.download_rate / 1000, status.upload_rate / 1000,
                status.num_peers, status.state), end=' ')

            alerts = self.session.pop_alerts()
            for a in alerts:
                if a.category() & lt.alert.category_t.error_notification:
                    print(a)
            time.sleep(1)
        return self.save_path + info.name


    def download_by_magnet(self, magnet, cb, save_path = None):
        info = lt.parse_magnet_uri(magnet)
        torrent_handle = self.session.add_torrent(info)
        status = torrent_handle.status()
        while not status.is_seeding:
            status = torrent_handle.status()

            print('\r%.2f%% complete (down: %.1f kB/s up: %.1f kB/s peers: %d) %s' % (
                status.progress * 100, status.download_rate / 1000, status.upload_rate / 1000,
                status.num_peers, status.state), end=' ')

            alerts = self.session.pop_alerts()
            for a in alerts:
                if a.category() & lt.alert.category_t.error_notification:
                    print(a)

            time.sleep(1)
        cb(self.save_path + info.name)

