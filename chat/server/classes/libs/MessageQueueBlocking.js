/**
 * This implements multi-address blocking message queue
 * The object is basically a hash table.
 * Keys are addresses, and values are queues.
 * When enqueueing - an address and a message are required.
 * Each address queue has mutex. Enqueueing or dequeueing
 * requires obtaining mutex lock.
 * If queue for given address is already initialized, then regular
 * enqueue / dequeue operation is invoked.
 * If not, queue init lock is acquired and queue is initialized.
 */
const Lock = require("./Lock.js")
const Logger = require("../libs/Logger.js")


class MessageQueueBlocking{
    constructor(){
        this._lock = new Lock()
        this._queue = []
    }

    async lock(){
        Logger.debug("Locking queue");
        return this._lock.acquire()
    }

    async unlock(){
        Logger.debug("Releasing the lock")
        this._lock.release()
    }

    async enqueue(obj){
        await this.lock();
        try{
            this._queue.push(obj);
        }catch(err){
            Logger.error("Error enqueueing obj: " + err, {stack: err.stack});
        }finally{
            this.unlock();
        }
    }

    async dequeue(){
        await this.lock()
        try{
            Logger.debug("Dequeueing from blocking message queue")
            return this._queue.shift();
        }catch(err){
            Logger.error("Error dequeueing: " + err, {stack: err.stack});
        }finally{
            await this.unlock()
        }
    }

    async remove(obj){
        Logger.debug("Removing object from queue")
        let index = this._queue.indexOf(obj)

        if (index === -1){
            Logger.debug("Object is not found.")
            return
        }

        await this.lock();
        try{
            return (index > -1) ? this._queue.splice(index, 1)[0] : undefined;
        }catch(err){
            Logger.error("Error removing object from the queue: " + err, {stack: err.stack})
        }finally{
            await this.unlock();
        }
    }

    length(){
        return this._queue.length;
    }

    isEmpty(){
        return this._queue.length === 0;
    }

}

module.exports = MessageQueueBlocking;
