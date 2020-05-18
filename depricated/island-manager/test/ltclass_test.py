from lib.islands_torrent import IslandsTorrent
from time import sleep
from threading import Thread
import sys
import asyncio


MAGNET = "magnet:?xt=urn:btih:a4004a78c6a0c885eceffc32da8bef2a873d8057&dn=Nuance%20PDF%20Converter%20Professional%207.20"

def download_torrent(it, cb):

    it.download_by_magnet(MAGNET, cb, ".")


def callback(res):
    print("Download successfull: " + res)


def download_with_thread():
    print("Initializing torrent")
    it = IslandsTorrent(".")
    downloader = Thread(target=download_torrent, args=[it, callback])
    downloader.start()


async def download_async():
    print("Initializing torrent")
    it = IslandsTorrent(".")
    await it.download_by_magnet_async(MAGNET)


async def main():
    print("Starting download")
    await download_async()
    print("Download completed")
    while True:
        print("Sleeping...")
        sys.stdout.flush()
        sleep(10)


if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(main())
    except Exception as e:
        pass
    finally:
        loop.close()

