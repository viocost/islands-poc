from time import sleep
from threading import Event, Thread


class Thing:
    def __init__(self):
        self.abort = Event()

    def abort_work(self):
        self.abort.set()

    def run_worker(self):
        t = Thread(target=worker, args=(self.abort, ))
        t.start()


def worker(abort_ev):
    while True:
        if abort_ev.is_set():
            print("Abort event received")
            return
        else:
            print("sleeping")
            sleep(1)


if __name__ == '__main__':
    t = Thing()
    t.run_worker()
    for i in range(5):
        print("main sleeping: %d" % i)
        sleep(1.5)
    t.abort_work()
    while True:
        print("work aborted")
        sleep(10)
