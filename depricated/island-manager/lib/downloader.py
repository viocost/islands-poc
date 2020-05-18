import urllib3 as urllib
import math
import os
import logging
import certifi

log = logging.getLogger(__name__)

class Downloader:
    def __init__(self):
        pass

    @staticmethod
    def get(url, dest_path, filename=None, on_update=None, abort=None):
        http = urllib.PoolManager(
                cert_reqs='CERT_REQUIRED', 
                ca_certs=certifi.where()
                )
        response = http.request('GET', url, preload_content=False)
        if response.status != 200:
            log.error("Virtualbox download error. Status: %s, " % str(response.status))
            return
            # Do error handling here
        if not filename:
            filename = url.split("/")[-1]

        dl_path = os.path.join(os.path.expanduser(dest_path), filename)
        blocksize = 8192 * 192
        filesize = int(response.headers.get('Content-length'))
        print(response.headers.get('Content-Disposition'))
        downloaded = 0
        progress = 0

        with open(dl_path, 'wb') as out:
            while True:
                if abort and abort.is_set():
                    log.debug("Vbox download aborted. Exiting...")
                    return
                data = response.read(blocksize)
                if not data:
                    print("Download completed!")
                    break
                out.write(data)
                downloaded += blocksize
                progress = math.floor(downloaded/(filesize * 0.01))
                if on_update:
                    on_update(progress=progress, downloaded=downloaded, total_size=filesize)
        return dl_path




