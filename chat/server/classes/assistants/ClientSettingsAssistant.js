const ClientError = require("../objects/ClientError.js");
const Err = require("../libs/IError.js");
const Request = require("../objects/ClientRequest.js");
const Response = require("../objects/ClientResponse.js");
const Metadata = require("../objects/Metadata.js");
const Events = require("../../../common/Events").Events;
const Internal = require("../../../common/Events").Internal;
const Message = require("../objects/Message.js");
const iCrypto = require("../libs/iCrypto.js");

const Logger = require("../libs/Logger.js");


class ClientSettingsAssistant{
    constructor(connectionManager = Err.required(),
                sessionManager = Err.required(),
                requestEmitter = Err.required(),
                historyManager = Err.required()){
        this.connectionManager = connectionManager;
        this.hm = historyManager;
        this.sessionManager = sessionManager;
        this.subscribeToClientRequests(requestEmitter);
    }

    subscribeToClientRequests(requestEmitter){
        let handlers = {}
        handlers[Internal.UPDATE_SETTINGS] = this.updateSettings;
        this.subscribe(requestEmitter, handlers, this.clientRequestErrorHandler);
    }


    async updateSettings(request, connectionID, self,){
        console.log("Updating settings");
        Logger.debug("Session update requesg", {cat: "settings"})
        const metadata = Metadata.parseMetadata(await self.hm.getLastMetadata(request.headers.pkfpSource));
        const publicKey = metadata.getParticipantPublicKey(request.headers.pkfpSource);

        if(!Request.isRequestValid(request, publicKey))  throw new Error("Update request is invalid");

        let ic = new iCrypto()
        ic.addBlob("settings", request.body.settings)
          .addBlob("sign", request.body.signature)
          .setRSAKey("pub", publicKey, "public")
          .publicKeyVerify("settings", "sign", "pub", "res")
        if(!ic.get("res")) throw new Error("Settings blob signature verification failed")


        metadata.setSettings(request.body.settings);
        await self.hm.appendMetadata(metadata.toBlob(), request.headers.pkfpSource);

        let response =  Message.makeResponse(request, "island", Internal.SETTINGS_UPDATED);
        response.body.metadata = metadata;
        response.body.settings = request.body.settings;
        response.body.signature = request.body.signature;
        let session = self.sessionManager.getSessionByConnectionId(connectionID);
        Logger.debug("Settings updated. Sending ", {cat: "settings"})
        session.broadcast(response);
    }

    /***** Error handlers *****/
    clientRequestErrorHandler(request, connectionID, self, err){
        console.trace(err);
        try{
            let error = new ClientError(request, self.getClientErrorType(request.headers.command) , "Internal server error")
            self.connectionManager.sendResponse(connectionID, error);
        }catch(fatalError){
            console.log("Some big shit happened: " + fatalError + "\nOriginal error: " + err);
            console.trace(err)
        }
    }

    /**
     * Generic subscribe function
     * @param emitter
     * @param handlers
     * @param errorHandler
     */
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
            Logger.error(`Client settings assistant error on command: ${command} : ${err.message}`, {stack: err.stack} )
            args.push(err);
            await errorHandler(...args);
        }
    }
}

module.exports = ClientSettingsAssistant;
