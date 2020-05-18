import redis
import time
import random
from threading import Thread


exiting = False



def get_worker(pubsub):
    def worker():
        while True:
            pubsub.get_message();
            time.sleep(0.001)
    return worker

def main():

    client = redis.Redis(host='localhost', port=6379)
    ps = client.pubsub()

    def cb(message):
        if exiting:
            return
        print("Receied a command: %s" % message)
        client.publish("test-out", "Message received!")
    ps.subscribe(**{"test-in": cb})

    t = Thread(target=get_worker(ps))
    t.start()
    while True:
        time.sleep(1)

if __name__ == "__main__":
    main()
