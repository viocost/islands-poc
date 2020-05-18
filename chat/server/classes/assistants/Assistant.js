const Err = require("../libs/IError.js");

class Assistant{
    constructor(historyManager = Err.required()){
        if (new.target === Assistant) {
            throw new TypeError("Cannot construct Assistant instances directly");
        }
        this.hm = historyManager;
    }

    /***** END Error handlers *****/
    subscribe(emitter = Err.required(),
              handlers = Err.required(),
              errorHandler = Err.required()){
        let self = this;
        Object.keys(handlers).forEach((command)=>{
            emitter.on(command, async(...args)=>{
                args.push(self);
                await self.handleRequest(handlers, command, args, errorHandler);
            })
        })
    }

    /**
     * Generic request handler
     * @param handlers - map of request-specific routines
     * @param command
     * @param args - array of arguments
     * @param errorHandler - request specific error handler
     * @returns {Promise<void>}
     */
    async handleRequest(handlers, command, args, errorHandler){
        try{
            await handlers[command](...args)
        }catch(err){
            args.push(err);
            await errorHandler(...args);
        }
    }






}

module.exports = Assistant;