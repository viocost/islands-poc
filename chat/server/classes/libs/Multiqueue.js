const Lock = require("./Lock.js");
const MessageQueueBlocking = require("./MessageQueueBlocking.js");
const Logger = require("./Logger.js");
const Err = require("../libs/IError");


/**
 * Collection of queues neede to properly process request events.
 * It is basically extended hashtable, where key is onion address and
 * value is request queue for given address.
 *
 * Whenever new address has created - the entire multiqueue must be locked.
 *
 *
 */
class Multiqueue{
    constructor(){
        this._lock = new Lock();
        this._queues = {}
    }

    async enqueue(dest = Err.required("dest"),
                  obj = Err.required("obj"), timeout, onTimeout){
        Logger.debug("Enqueueing object for: " + dest);
        if (!this._queues.hasOwnProperty(dest)){
            try {
                await this._lock.acquire();
                if(!this._queues.hasOwnProperty(dest)){
                    this._queues[dest] = new MessageQueueBlocking();
                }
            }catch(e){
                Logger.error("Error enqueueing message: " + e)
            }finally{
                this._lock.release();
            }
        }

        //Here we are sure that queue exists
        let queue = this._queues[dest];
        try{
            await queue.enqueue(obj);
            if (typeof timeout === "number" && timeout > 0){
                setTimeout(this.getTimeoutHandler(dest, obj, onTimeout), timeout);
            }
        }catch(e){
            Logger.error("Error enqueueing message: " + e)
        }finally{
            queue.unlock();
        }
    }

    getTimeoutHandler(key, obj, onTimeout){
        let self = this
        return async ()=>{
            Logger.debug("standard onTimeout handler called for expired object.")
            let queue = self.get(key)
            let removed = await queue.remove(obj);
            if (removed === undefined){
                Logger.debug("Object has been processed in time")
                return;
            }
            if (typeof onTimeout === "function"){
                onTimeout(obj);
            }
        }
    }

    get(key){
        Logger.debug("Get queue request for key: " + key + " Existing keys are: " + JSON.stringify(Object.keys(this._queues)))
        return this._queues[key];
    }

    isEmpty(key){
        return this._queues.hasOwnProperty(key) ? this._queues[key].isEmpty() : true;
    }

}


module.exports = Multiqueue;
