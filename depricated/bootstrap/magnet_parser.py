import re
from urllib.parse import urlencode, urlparse, quote, unquote

def is_sha1(s):
    try:
        test = int(s, 16)
        return len(s) == 40
    except (ValueError, TypeError):
        return False


def parse(magnet):
    parsed = urlparse(magnet)
    if parsed.scheme != 'magnet':
        raise ValueError("Invalid magnet link")
    res = {}
    res['trackers'] = []
    for param in parsed.query.split("&"):
        data = param.split("=")

        if data[0] == "xt":
            for bit in reversed(data[1].split(":")):
                if is_sha1(bit):
                    res["info_hash"] = bit
                    break
        elif data[0] == "tr":
            res['trackers'].append(unquote(data[1]))
        elif data[0] == "dn":
            res['name'] = unquote(data[1])
        else:
            res[data[0]] = data[1]
    return res


def construct(info_hash, name, trackers = []):
    params = []
    params.append(("xt", "urn:btih:%s" % info_hash))
    params.append(("dn", name))
    for tracker in trackers:
        params.append(("tr", tracker))
    return "".join(["magnet:?", urlencode(params)])


def test():
    m1 = "magnet:?xt=urn:btih:9B63761F7CDB78669136B30AEF4F0ABA80B91C88&tr=http%3A%2F%2Fbt.t-ru.org%2Fann%3Fmagnet&dn=(Rap%20%2F%20Hip-Hop)%20The%20Alchemist%20-%20Yacht%20Rock%202%20-%202019%2C%20MP3%2C%20320%20kbps"
    m2 = "magnet:?xt=urn:btih:6c6b14536fb24842ff416e35770284cd21c9442c&dn=The+Alchemist+25th+Anniversary+Edition+by+Paulo+Coelho+ePub&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=udp%3A%2F%2Fopen.demonii.com%3A1337&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Fexodus.desync.com%3A6969"
    parsed = parse(m1)
    print (parsed["info_hash"])
    print (parsed["name"])
    print (", ".join(parsed["trackers"]))
    parsed = parse(m2)
    print (parsed["info_hash"])
    print (parsed["name"])
    print (", ".join(parsed["trackers"]))

    constructed = construct(parsed["info_hash"], parsed["name"], parsed["trackers"])
    print("\n\n")
    print(constructed)





if __name__ == "__main__":
    test()
