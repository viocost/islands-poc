const Envelope = require("../objects/CrossIslandEnvelope.js");
const Message = require("../objects/Message.js");
const ClientError = require("../objects/ClientError.js");
const Err = require("../libs/IError.js");
const Request = require("../objects/ClientRequest.js");
const Response = require("../objects/ClientResponse.js");
const OutgoingPendingJoinRequest = require("../objects/OutgoingPendingJoinRequest.js");
const Invite = require("../objects/Invite.js");
const Util = require("../libs/ChatUtility.js");
const Logger = require("../libs/Logger.js");
const { Events, Internal } = require("../../../common/Events");
const semver = require("semver")


class TopicJoinAssistant {
    constructor(connectionManager = Err.required(),
                sessionManager = Err.required(),
                requestEmitter = Err.required(),
                historyManager = Err.required(),
                topicAuthorityManager = Err.required(),
                crossIslandMessenger = Err.required(),
                connector = Err.required(),
                vaultManager = Err.required()) {

        this.connector = connector;
        this.crossIslandMessenger = crossIslandMessenger;
        this.connectionManager = connectionManager;
        this.sessionManager = sessionManager;
        this.hm = historyManager;
        this.vaultManager = vaultManager;
        this.topicAuthorityManager = topicAuthorityManager;
        this.subscribeToClientRequests(requestEmitter);
        this.subscribeToCrossIslandsMessages(crossIslandMessenger);
        this.pendingOutgoingJoinRequests = {};
    }

    /*****************************************************
     * INCOMING REQUEST HANDLERS
     *****************************************************/

    async joinTopicIncoming(envelope, self) {
        Logger.debug("Join topic incoming request receives", {cat: "topic_join"});
        const request = Request.parse(envelope.payload);

        if(semver.lt("2.0.0", request.headers.version)){
            Logger.debug("Legacy join request", {cat: "topic_join"})
            await self.joinTopicIncomingLegacy(envelope, self)
            return;
        }
        const invite = Invite.parse(request.body.inviteString);
        const topicAuthority = self.topicAuthorityManager.getTopicAuthority(invite.getPkfp());
        console.log("\n\n METADATA AT JOIN TOPIC INCOMING: " + topicAuthority.getCurrentMetadata().toBlob()+"\n\n")
        //let currentMetadata = topicAuthority.getCurrentMetadata().toBlob();
        let newTopicData = await topicAuthority.joinByInvite(request.body.inviteString, request.body.invitee, envelope.origin);
        Logger.debug("Join topic request processed by topic authority", {cat: "topic_join"});
        const response = new Response(Internal.JOIN_TOPIC_SUCCESS, request);
        response.setAttribute("metadata", newTopicData.metadata);
        response.body["inviterNickname"] =  newTopicData.inviterNickname;
        response.body["inviterPkfp"] = newTopicData.inviterPkfp;

        const responseEnvelope = new Envelope(envelope.origin, response, envelope.destination);
        responseEnvelope.setResponse();
        Logger.debug("Sending metadata to the invitee", {cat: "topic_join"});
        await self.crossIslandMessenger.send(responseEnvelope);
    }

    //LEGACY
    async joinTopicIncomingLegacy(envelope, self){
        Logger.debug("Join topic incoming request receives", {cat: "topic_join"});
        const request = Request.parse(envelope.payload);
        const invite = Invite.parse(request.body.inviteString);
        const topicAuthority = self.topicAuthorityManager.getTopicAuthority(invite.getPkfp());
        let newTopicData = await topicAuthority.joinByInvite(request.body.inviteString, request.body.invitee, envelope.origin);
        Logger.debug("Join topic request processed by topic authority", {cat: "topic_join"});
        const response = new Response("join_topic_success", request);
        response.setAttribute("metadata", newTopicData.metadata);
        response.setAttribute("inviterNickname", newTopicData.inviterNickname);
        response.setAttribute("inviterPkfp", newTopicData.inviterPkfp);
        response.setAttribute("topicName", newTopicData.topicName);
        const responseEnvelope = new Envelope(envelope.origin, response, envelope.destination);
        responseEnvelope.setResponse();
        Logger.debug("Sending metadata to the invitee", {cat: "topic_join"});
        await self.crossIslandMessenger.send(responseEnvelope);

    }

    /*****************************************************
     * ~END INCOMING REQUEST HANDLERS
     *****************************************************/


    /*****************************************************
     * OUTGOING REQUEST HANDLERS
     *****************************************************/

    async joinTopicOutgoing(request, connectionID, self) {
        Logger.debug("Sending outgoing topic join request", {cat: "topic_join"});
        self.verifyOutgoingRequest(request);
        const hsData = await self.createHiddenService();

        let vault = request.vault;
        let vaultSign = request.vaultSign;
        let vParsed = JSON.parse(vault);
        let publicKey = self.vaultManager.getVaultPublicKey(vParsed.id);

        if (!Util.verify(vault, publicKey, vaultSign)) throw new Error("Vault signature was not verified!")

        const pendingJoinRequest = new OutgoingPendingJoinRequest(
            request.headers.pkfpSource,
            request.body.inviteCode,
            request.body.invitee.publicKey,
            hsData.serviceID,
            hsData.privateKey,
            connectionID,
            vParsed.record,
            vParsed.id);
        self.registerOutgoinTopicJoinRequest(pendingJoinRequest);
        await self.sendOutgoingRequest(request, pendingJoinRequest.hsid);
    }


    /**
     * Called when join_topic_success response from other island is received.
     * It means that new user is now registered in the topic, and existing members are notified
     * The function initializes the topic and notifies the client
     * @param {CrossIslandEnvelope} envelope
     * @param {this} self
     */
    async finalizeTopicJoin(envelope, self) {
        //Verify, save metadata, return new topic data to the client
        try {
            Logger.debug("Finalize topic join.", {cat: "topic_join"});
            let taResponse = envelope.payload;
            const pendingRequest = self.getOutgoingPendingJoinRequest(taResponse.headers.pkfpSource);
            const metadata = taResponse.body.metadata;
            const hsPrivateKeyEncrypted = Util.encryptStandardMessage(pendingRequest.hsPrivateKey, pendingRequest.publicKey);

            Logger.debug("Initializing history and service", {cat: "topic_join"});

            self.hm.initTopic(taResponse.headers.pkfpSource,
                pendingRequest.publicKey,
                hsPrivateKeyEncrypted);
            await self.hm.initHistory(taResponse.headers.pkfpSource, metadata);

            Logger.debug("Saving vault record", {cat: "topic_join"});
            await self.vaultManager.saveTopic(
                pendingRequest.vaultId,
                pendingRequest.pkfp,
                pendingRequest.vaultRecord
            )
            Logger.debug("Topic data saved. Sending response to clients", {cat: "topic_join"});
            let response = new Message();
            response.setSource("island");
            response.setCommand(Internal.JOIN_TOPIC_SUCCESS);
            response.setDest(pendingRequest.inviteCode);
            response.body.vaultRecord = pendingRequest.vaultRecord;
            response.body.metadata = taResponse.body.metadata;
            response.body.inviterNickname = taResponse.body.inviterNickname;
            response.body.inviterPkfp = taResponse.body.inviterPkfp;
            response.body.inviteCode = pendingRequest.inviteCode;
            let session = self.sessionManager.getSessionBySessionID(pendingRequest.vaultId);
            session.addTopic(pendingRequest.pkfp);
            if(!session){
                Logger.warn(`Session ${pendingRequest.vaultId} not found.`)
                return;
            }
            await session.signMessage(response);
            session.broadcast(response);
            Logger.debug("Join notification sent!", {cat: "topic_join"});
        } catch (err) {
            Logger.error("Error finalizing topic join request: " + err.message + " " + err.stack, {cat: "topic_join"});
            self.processFinalizeJoinError(self, envelope, err);
        }

    }

    /*****************************************************
     * ~END OUTGOING REQUEST HANDLERS
     *****************************************************/

    /*****************************************************
     * HELPERS
     *****************************************************/

    getOutgoingPendingJoinRequest(pkfp) {
        if (this.pendingOutgoingJoinRequests[pkfp]) {
            return this.pendingOutgoingJoinRequests[pkfp];
        } else {
            throw new Error("Topic join error: pending join request not found!");
        }

    }

    verifyIncomingRequest(request) {
        return Request.isRequestValid(request);
    }

    async sendOutgoingRequest(request = Err.required(),
                              inviteeResidence = Err.required) {
        const dest = request.body.destination;
        const envelope = new Envelope(dest, request, inviteeResidence);
        await this.crossIslandMessenger.send(envelope);
    }

    registerOutgoinTopicJoinRequest(pendingRequest) {
        this.pendingOutgoingJoinRequests[pendingRequest.pkfp] = pendingRequest;
    }

    async abortPendingJoinRequest(self = Err.required(), pkfp = Err.required()){
        Logger.debug(`Aborting pending join request`, {cat: "topic_join"});
        const pendingJoinRequest = self.pendingOutgoingJoinRequests[pkfp];
        if(!pendingJoinRequest) return;
        let hsid = pendingJoinRequest.hsid;

        if(await self.connector.isHSUp(hsid)){
            Logger.debug(`Taking down ${hsid} on join abort`, {cat: "topic_join"});
            await self.connector.killHiddenService(hsid)
        }

        delete self.pendingOutgoingJoinRequests[pkfp]
    }

    verifyOutgoingRequest(request) {
        Request.isRequestValid(request, request.body.invitee.publicKey, {
            pkfpSource: true,
            pkfpDest: true,
            bodyContent: ["inviteCode", "destination", "invitee"]
        });
    }

    createHiddenService() {
        return this.connector.createHiddenService();
    }


    //Subscribes to relevant client requests
    subscribeToClientRequests(requestEmitter) {
        let handlers = {}
        handlers[Internal.JOIN_TOPIC] = this.joinTopicOutgoing;
        this.subscribe(requestEmitter, handlers, this.clientRequestErrorHandler);
    }

    //Subscribes to relevant cross-island requests
    subscribeToCrossIslandsMessages(ciMessenger) {
        let handlers = {}
        handlers[Internal.JOIN_TOPIC] = this.joinTopicIncoming;
        handlers[Internal.JOIN_TOPIC_SUCCESS] = this.finalizeTopicJoin;
        this.subscribe(ciMessenger, handlers, this.crossIslandErrorHandler);

        //refactor this:
        this.subscribe(ciMessenger, {
            return_join_topic: this.processJoinTopicErrorOnReturn,
        }, this.crossIslandErrorHandler);
    }


    async processFinalizeJoinError(self, envelope, err){
        let errMsg = "unknown error";
        if(err && err.message) errMsg = err.message
        else if (err && err.constructor.name === "String") errMsg = err;
        Logger.error(`Finalize topic join error: ${errMsg}`, {cat: "topic_join"});
        await self.processJoinTopicError(self, envelope, errMsg)
    }

    async processJoinTopicErrorOnReturn(envelope, self){
        Logger.warn("Join topic failed. Return envelope received. Error: " + envelope.error, {cat: "topic_join"});
        await self.processJoinTopicError(self, envelope, envelope.error)
    }

    /***** Error handlers *****/
    /**
     * This function is called when return envelope received
     * from other island.
     */
    async processJoinTopicError(self, envelope, errMsg) {
        try{
            let request = envelope;

            while(request.payload){
                request = request.payload;
            }

            const pendingRequest = self.getOutgoingPendingJoinRequest(request.headers.pkfpSource);
            const connId = pendingRequest.connId;
            const vaultId = pendingRequest.vaultId;

            await self.abortPendingJoinRequest(self, pendingRequest.pkfp);
            let msg = new Message()
            msg.setCommand(Internal.JOIN_TOPIC_FAIL)
            msg.setSource("island")
            msg.setDest(pendingRequest.inviteCode)
            msg.body.errorMsg = errMsg;
            let session = self.sessionManager.getSessionByConnectionId(connId);
            if (!session){
                Logger.warn(`Session ${connId} is not found`)
                return;
            }
            await session.signMessage(msg);
            session.send(msg, connId);
        } catch(err){
            //logging
        }
    }

    //special case if error occurs during finalize


    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // async processJoinTopicError(message, self, error = undefined) {                                                       //
    //     try {                                                                                                             //
    //         //Kill hidden services                                                                                        //
    //         const pendingRequest = self.getOutgoingPendingJoinRequest(message.headers.pkfpSource);                        //
    //         let message                                                                                                   //
    //         //Send notification to that connection that invite failed                                                     //
    //                                                                                                                       //
    //         let clientError = new ClientError(message,                                                                    //
    //             self.getClientErrorType(message.headers.command),                                                         //
    //             error ? error : "unknown error");                                                                         //
    //         if (pendingRequest) {                                                                                         //
    //             self.connectionManager.sendResponse(pendingRequest.connectionId, clientError);                            //
    //             delete self.pendingOutgoingJoinRequests[message.headers.pkfpSorce];                                       //
    //         }                                                                                                             //
    //     } catch (err) {                                                                                                   //
    //         Logger.error("FATAL ERROR while processing join topic error: " + err + " " + err.stack, {cat: "topic_join"}); //
    //     }                                                                                                                 //
    // }                                                                                                                     //
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    async clientRequestErrorHandler(request, connectionId, self, err) {

        let errMsg = "Unknown error";
        if(err){
            errMsg = err.message || err;
        }
        let session = self.sessionManager.getSessionByConnectionId(connectionId);
        if (!session){
            Logger.warn(`No session found for ${connctionId}`, {cat: "topic_join"})
            return
        }

        let msg = new Message()
        msg.setCommand(Internal.JOIN_TOPIC_FAIL)
        msg.setSource("island")
        msg.setDest(session.id)
        msg.body.errorMsg = errMsg;
        await session.signMessage(msg);
        session.send(msg, connectionId);
    }


    getClientErrorType(command) {
        const errorTypes = {
            join_topic: "join_topic_error"
        };
        if (!errorTypes.hasOwnProperty(command)) {
            throw new Error("invalid error type");
        }
        return errorTypes[command];
    }

    async crossIslandErrorHandler(envelope, self, err) {
        try {
            let errMsg = "Unknown error";

            if(err){
                errMsg = err.message || err;
            }

            if (envelope.return) {
                Logger.error("Error handling return envelope: " + errMsg , {cat: "topic_join", stack: err.stack});
                return;
            }
            Logger.warn("Topic join error: " + errMsg + " returning envelope...", {cat: "topic_join", stack: err.stack});
            await self.crossIslandMessenger.returnEnvelope(envelope, errMsg);
        } catch (fatalErr) {
            Logger.error("FATAL ERROR" + fatalErr + " " + fatalErr.stack, {cat: "topic_join", stack: fatalErr.stack});
            console.trace("FATAL ERROR: " + fatalErr);
            console.log(`envelope orig: ${envelope.origin}, dest: ${envelope.destination}`)
        }

    }

    /***** END Error handlers *****/


    /**
     * Generic subscribe function
     * @param emitter
     * @param handlers
     * @param errorHandler
     */
    subscribe(emitter = Err.required(),
              handlers = Err.required(),
              errorHandler = Err.required()) {
        let self = this;
        Object.keys(handlers).forEach((command) => {
            emitter.on(command, async (...args) => {
                args.push(self);
                await self.handleRequest(handlers, command, args, errorHandler);
            });
        });
    }

    /**
     * Generic request handler
     * @param handlers - map of request-specific routines
     * @param command
     * @param args - array of arguments
     * @param errorHandler - request specific error handler
     * @returns {Promise<void>}
     */
    async handleRequest(handlers, command, args, errorHandler) {
        try {
            await handlers[command](...args)
        } catch (err) {
            args.push(err);
            await errorHandler(...args);
        }
    }


    /*****************************************************
     * ~END HELPERS
     *****************************************************/


}


module.exports = TopicJoinAssistant;
