
import lib.vendor.libtorrent as lt
import time
import sys

def set_global_limits(ses):

    peer_class = ses.get_peer_class(lt.session.global_peer_class_id)
    peer_class["download_limit"] = 100
    peer_class["upload_limit"] = 200
    ses.set_peer_class(lt.session.global_peer_class_id, peer_class)
    peer_class = ses.get_peer_class(lt.session.global_peer_class_id)


def dump_session_data(ses):
    entry = ses.save_state()
    with open("session_dump", "wb") as fp:
        fp.write(lt.bencode(entry))
    print("Data saved")

def load_session_data():
    with open("session_dump", "rb") as fp:
        entry = lt.bdecode(fp.read())
        s = lt.session({'listen_interfaces': '0.0.0.0:6881'})
        s.load_state(entry)
        return s

# params = {
#
# 	'file_priorities': [0] * 1000,
# 	'flag_auto_managed': False,
# 	'flag_stop_when_ready': True,
# 	'upload_mode': True
# }

def init_session():
    return lt.session({'listen_interfaces': '0.0.0.0:6881'})

def get_session_stats(session):
    metrics = lt.session_stats_metrics()
    print("About to post stats")

    session.post_session_stats()
    print("Posted")
    start = time.time()



    print("Alerts arrived " + str(time.time()-start))
    while True:
        alert = session.wait_for_alert(10000)
        alert = session.pop_alert()
        if alert is None:
            print("No alerts")
            break
        if type(alert) == lt.session_stats_alert:
            print("Got right one")
            print(alert.values)
        else:
            print("Wrong alert")

            print(type(alert))
    time.sleep(.5)
    print("All set")




def add_test_magnet(session, magnet = "magnet:?xt=urn:btih:bb7d284f8a79f30d5243c77a7dfe5e262261c152&dn=Islands.dmg"):
    """
    Returns torrent handle
    :param session:
    :param magnet:
    :return:
    """
    info = lt.parse_magnet_uri(magnet)
    return session.add_torrent(info)



def await_download_complete(session, torrent_handle):
    s = torrent_handle.status()
    print('starting', s.name)

    while not s.is_seeding:
        s = torrent_handle.status()

        print('\r%.2f%% complete (down: %.1f kB/s up: %.1f kB/s peers: %d) %s' % (
            s.progress * 100, s.download_rate / 1000, s.upload_rate / 1000,
            s.num_peers, s.state), end=' ')

        alerts = session.pop_alerts()
        for a in alerts:
            if a.category() & lt.alert.category_t.error_notification:
                print(a)

        sys.stdout.flush()

        time.sleep(1)
    print(torrent_handle.name(), 'complete')


# info.file_priorities = [0] * 1000
# info.flag_stop_when_ready = False
# info.upload_mode = True
# info.flag_auto_managed = True

def create_torrent(session, f_path="D:\\test\\islands_manager.log"):
    storage = lt.file_storage()
   # lt.add_files(storage, f_path)
    ct = lt.create_torrent(storage)
    entry = ct.generate()
    print(type(entry))
    t_info = lt.torrent_info(entry)
    atp = lt.add_torrent_params()
    atp.ti = t_info

    h = session.add_torrent(atp)

    print("boo")


if __name__ == '__main__':
    session = init_session()
    # settings = session.get_settings()
    # print(settings["alert_mask"])
    # settings["alert_mask"] = 8
    # session.apply_settings(settings)
    create_torrent(session)
    print("Ok")




