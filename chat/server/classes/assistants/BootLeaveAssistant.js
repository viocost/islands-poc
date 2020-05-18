const Err = require("../libs/IError.js");
const Assistant = require("../assistants/Assistant.js");
const ClientError = require("../objects/ClientError.js");
const Request = require("../objects/ClientRequest.js");
const Message = require("../objects/Message.js");
const Response = require("../objects/ClientResponse.js");
const Envelope = require("../objects/CrossIslandEnvelope.js");
const Metadata = require("../objects/Metadata.js");
const Logger = require("../libs/Logger");
const Events = require("../../../common/Events").Events;
const Internal = require("../../../common/Events").Internal;

class BootLeaveAssistant extends Assistant{
    constructor(connectionManager = Err.required(),
                sessionManager = Err.required(),
                requestEmitter = Err.required(),
                historyManager = Err.required(),
                topicAuthorityManager = Err.required(),
                crossIslandMessenger = Err.required(),
                vaultManager = Err.required(),
                torConnector = Err.required()){
        super(historyManager);
        this.crossIslandMessenger = crossIslandMessenger;
        this.vaultManager = vaultManager;
        this.connectionManager = connectionManager;
        this.sessionManager = sessionManager;
        this.topicAuthorityManager = topicAuthorityManager;
        this.connector = torConnector;
        this.subscribeToClientRequests(requestEmitter);
        this.subscribeToCrossIslandsMessages(crossIslandMessenger);
    }

    /*****************************************************
     * HANDLERS
     *****************************************************/
    async bootParticipantOutgoing(request, connectionID, self){
        console.log("\nBOOTING PARTICIPANT\n");
        const publicKey = await self.hm.getOwnerPublicKey(request.headers.pkfpSource);
        if(!Request.isRequestValid(request, publicKey)){
            throw new Error("Boot request was not verified");
        }
        const metadata = JSON.parse(await self.hm.getLastMetadata(request.headers.pkfpSource));
        const client =metadata.body.participants[request.headers.pkfpSource];
        if(client.rights < 3){
            throw new Error("User has not enough rights to boot");
        }

        await self.crossIslandMessenger.send(new Envelope(metadata.body.topicAuthority.residence, request, client.residence));
    }

    async bootParticipantIncoming(envelope, self){
        console.log("\nbooting participant incoming received \n");
        let request = envelope.payload;
        let ta = self.topicAuthorityManager.getTopicAuthority(request.headers.pkfpDest);
        await ta.processBootRequest(request);
    }

    async leaveTopicOnBoot(envelope, self){
        console.log("I has been booted... leaving topic");
        let message = envelope.payload;
        let lastMetadata = Metadata.parseMetadata(await self.hm.getLastMetadata(message.headers.pkfpDest));
        if(!Request.isRequestValid(message, lastMetadata.body.topicAuthority.publicKey)){
            console.log("FALSE BOOT REQUEST");
            return;
        }

        lastMetadata = lastMetadata.seal();
        await self.hm.appendMetadata(lastMetadata.toBlob(), message.headers.pkfpDest);

        self.sessionManager.broadcastServiceMessage(message.headers.pkfpDest, message);
    }

    /**
     * Deletes topic history
     * @param request
     * @param connectionID
     * @param self
     * @returns {Promise<void>}
     */
    async deleteTopic(request, connectionID, self){
        Logger.debug("Deleting topic")
        let pkfp = request.body.topicPkfp;

        const publicKey = await self.hm.getOwnerPublicKey(pkfp);
        if(!Request.isRequestValid(request, publicKey)){
            throw new Error("Delete topic request was not verified");
        }

        let metadata = Metadata.parseMetadata(await self.hm.getLastMetadata(pkfp));
        let userResidence = metadata.body.participants[pkfp].residence;
        let taResidence = metadata.body.owner === pkfp ? metadata.body.topicAuthority.residence : null
        if(await self.connector.isHSUp(userResidence)){
            Logger.info(`Taking down user hidden service ${userResidence} on toipc delete`, {cat: "topic_delete"})
            try{
                //await self.connector.killHiddenService(userResidence);
            }catch(err){console.log(`err deleting tor: ${err.message}`)}
        }
        if (metadata.body.owner === pkfp ){
            if ( await self.connector.isHSUp(taResidence)){
                Logger.info(`Taking down toipc authority service ${taResidence} on topic delete`, {cat: "topic_delete"})
                try{
                   // await self.connector.killHiddenService(taResidence);
                }catch(err){console.log(`err deleting tor: ${err.message}`)}
            }
            await self.hm.deleteTopic(metadata.body.topicAuthority.pkfp)
        } else {
            //just sending leave note to topic authority
            let envelope = new Envelope(taResidence, request, userResidence);
            self.crossIslandMessenger.send(envelope);
        }

        await self.hm.deleteTopic(pkfp);

        await self.vaultManager.deleteTopic(request.body.vaultId,
                                            pkfp,
                                            request.body.vaultNonce,
                                            request.body.vaultSign)
        //let response = new Response("delete_topic_success", request);

        let response = Message.makeResponse(request, "island", Internal.TOPIC_DELETED);
        response.body.vaultNonce = request.body.vaultNonce;
        response.body.vaultSign = request.body.vaultSign;
        response.body.topicPkfp = pkfp;
        Logger.debug("Topic has been deleted successfully. Sending notification to client", {cat: "topic_delete"})
        let session = self.sessionManager.getSessionByConnectionId(connectionID);
        session.deleteTopic(pkfp);
        session.broadcast(response);
    }

    async processTopicLeave(envelope, self){

        let request = envelope.payload;
        let ta = self.topicAuthorityManager.getTopicAuthority(request.headers.pkfpDest);
        assert(ta, `No toipc authority ${request.headers.pkfpDest} found, or it is not launched`)
        let metadata = ta.getCurrentMetadata()

        const publicKey = metadata.body.participants[request.headers.pkfpSource].publicKey;
        assert(Request.isRequestValid(request, publicKey), "Leave request was not verified")

        await ta.processTopicLeave(request.headers.pkfpSource);


    }

    //TODO
    async leaveTopic(request, connectionId, self){
        Logger.debug("Leaving toipc", {cat: "topic_delete"})
        let pkfp = request.body.topicPkfp;

        const publicKey = await self.hm.getOwnerPublicKey(pkfp);
        if(!Request.isRequestValid(request, publicKey)){
            throw new Error("Delete topic request was not verified");
        }

        let metadata = Metadata.parseMetadata(await self.hm.getLastMetadata(pkfp));
        let userResidence = metadata.body.participants[pkfp].residence;
        let taResidence = metadata.body.owner === pkfp ? metadata.body.topicAuthority.residence : null

        //sending leave note to TA
        let envelope = new Envelope(taResidence, request, userResidence);
        self.crossIslandMessenger.send(envelope);

        if(await self.connector.isHSUp(userResidence)){
            Logger.info(`Taking down user hidden service ${userResidence} on toipc delete`, {cat: "topic_delete"})
            try{
                await self.connector.killHiddenService(userResidence);
            }catch(err){console.log(`err deleting tor: ${err.message}`, {cat: "topic_delete"})}
        }

        if (request.body.deleteHistory){
            Logger.debug("Deleting history on leave", {cat: "topic_delete"});
            await self.hm.deleteTopic(pkfp);
            await self.vaultManager.deleteTopic(request.body.vaultId,
                                                pkfp,
                                                request.body.vaultNonce,
                                                request.body.vaultSign)
        }


        let response = Message.makeResponse(request, "island", Internal.TOPIC_DELETED);
        response.body.vaultNonce = request.body.vaultNonce;
        response.body.vaultSign = request.body.vaultSign;
        response.body.topicPkfp = pkfp;
        Logger.debug("Topic has been deleted successfully. Sending notification to client", {cat: "topic_delete"})
        let session = self.sessionManager.getSessionByConnectionId(connectionID);
        session.deleteTopic(pkfp);
        session.broadcast(response);
        //////////////////////////////
        // send leave note to TA    //
        //                          //
        // if owner:                //
        //     seal TA              //
        //     set destroy TA timer //
        //                          //
        //                          //
        // if delete history        //
        //     delete  history      //
        // else                     //
        //     seal history         //
        //////////////////////////////





    }


    /***Error handlers****/
    async crossIslandErrorHandler(envelope, self, err){
        try{
            if(envelope.return){
                Logger.warn("Error processing return envelope: " + err);
                return;
            }
            Logger.warn("Boot/leave error: " + err + " returning envelope...");
            await self.crossIslandMessenger.returnEnvelope(envelope);
        }catch(err){
            Logger.error("FATAL ERROR: " + err, {stack: err.stack});
        }
    }


    async clientErrorHandler(request, connectionId, self, err){
        try{
            Logger.warn("Error handling client request: " + err.message, {stack: err.stack, cat: "topic_delete"});
            let session = self.sessionManager.getSessionByConnectionId(connectionId);

            if (!session){
                Logger.warn(`No session found for ${connctionId}`, {cat: "topic_join"})
                return
            }

            let msg = new Message();
            msg.setSource("island");
            msg.setCommand(self.getClientErrorType(request.headers.command))
            msg.setDest(request.headers.pkfpSource);
            msg.body.errorMsg = err.message;
            await session.signMessage(msg);
            session.send(msg, connectionId)

        }catch(fatalError){
            Logger.error("FATAL ERROR while handling client request: " + fatalError + " " + fatalError.stack, {cat: "topic_delete"});
        }
    }


    getClientErrorType(command){
        let errorTypes = {}
        errorTypes[Internal.DELETE_TOPIC] = Internal.DELETE_TOPIC_ERROR;
        errorTypes[Internal.BOOT_PARTICPANT] = Internal.BOOT_PARTICPANT_ERROR;

        if (errorTypes.hasOwnProperty(command)){
            return errorTypes[command]
        } else {
            throw new Error(`Invalid error type for ${command}`)
        }
    }

    /*****************************************************
     * ~END HANDLERS
     *****************************************************/
    /*****************************************************
     * UTILS
     *****************************************************/
    subscribeToClientRequests(requestEmitter){
        this.subscribe(requestEmitter, {
            boot_participant: this.bootParticipantOutgoing,
            delete_topic: this.deleteTopic

        }, this.clientErrorHandler)
    }


    subscribeToCrossIslandsMessages(crossIslandMessenger){
        let handlers = {
            boot_participant: this.bootParticipantIncoming,
            u_booted: this.leaveTopicOnBoot
        }
        handlers[Internal.DELETE_TOPIC] = this.processTopicLeave
        this.subscribe(crossIslandMessenger, handlers, this.crossIslandErrorHandler)
    }
    /*****************************************************
     * ~END UTILS
     *****************************************************/
}

module.exports = BootLeaveAssistant;
