import { WildEmitter } from "./WildEmitter";
import { Lock } from "./Lock";

/**
 * This class is responsible for following:
 *   1. Sending arbitrary messages asyncronously in FIFO fasion.
 */
export class MessageQueue{

    constructor(connector){
        WildEmitter.mixin(this);
        this.lock = new Lock();
        this.connector = connector;
        this.queue = [];
        this.stop = false;
        this.launchQueueWorker();
    }

    async enqueue(msg){
        let self = this
        setImmediate(async ()=>{
            try{
                await self.lock.acquire();
                this.queue.push(msg);
            }catch(err){
                console.error(`Enqueue error: ${err.message} `);
            }finally{
                self.lock.release();
            }

        })
    }

    //Processes the queue: dequeues each message one by one and send it down the wire
    launchQueueWorker(){
        let self = this;
        let processQueue = async ()=>{
            if(self.stop){
                console.log("Stop set to true... Stopping worker.");
                this.working = false;
                return;
            }
            try{
                this.working = true;
                await self.lock.acquire();
                let msg
                while(msg = self.queue.shift(0)){
                    self.connector.send(msg);
                }
            }catch(err){
                console.error(`Queue processor error ${err.message}`);
            }finally{
                self.lock.release();
                //Repeat after 300ms
                setTimeout(processQueue, 300);
            }
        }
        setImmediate(processQueue);
    }

    stop(){
        this.stop = ture;
    }

    resume(){
        console.log("Resuming worker..");
        if(!this.working){
            this.stop = false;
            this.launchQueueWorker();
        }
    }

    isWorking(){
        return this.working;
    }

}
