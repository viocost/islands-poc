const { EventEmitter } = require("events");

class Lock{
    constructor(){
        this._locked = false;
        this._emitter = new EventEmitter();
    }

    acquire(){
        return new Promise(resolve =>{
            if (!this._locked){
                this._locked = true;
                return resolve()
            }

            const tryAcquire = ()=>{
                if (!this._locked){
                    this._locked = true;
                    this._emitter.removeListener("release", tryAcquire);
                    return resolve();
                }
            }
            this._emitter.on("release", tryAcquire);
        })
    }

    release(){
        this._locked = false;
        setImmediate(()=> this._emitter.emit("release"));
    }

    isLocked(){
        return this._locked;
    }
}

module.exports = Lock;
