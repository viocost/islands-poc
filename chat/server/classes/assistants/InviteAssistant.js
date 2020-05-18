const Envelope = require("../objects/CrossIslandEnvelope.js");
const ClientError = require("../objects/ClientError.js");
const Err = require("../libs/IError.js");
const Request = require("../objects/ClientRequest.js");
const Message = require("../objects/Message.js")
const Logger = require("../libs/Logger.js");
const Metadata = require("../objects/Metadata.js");
const Coordinator = require("./AssistantCoordinator.js");
const { Events, Internal } = require("../../../common/Events.js");

class InviteAssistant{
    constructor(connectionManager = Err.required(),
                sessionManager = Err.required(),
                requestEmitter = Err.required(),
                historyManager = Err.required(),
                topicAuthorityManager = Err.required(),
                crossIslandMessenger = Err.required()) {

        this.crossIslandMessenger = crossIslandMessenger;
        this.connectionManager = connectionManager;
        this.sessionManager = sessionManager;
        this.hm = historyManager;
        this.topicAuthorityManager = topicAuthorityManager;
        this.subscribeToClientRequests(requestEmitter);
        this.subscribeToCrossIslandsMessages(crossIslandMessenger);

        this.pendingInviteRequests = {};

    }

    /*****************************************************
     * HANDLERS
     *****************************************************/

    /**
     * Verifies and sends to topic authority on some other island
     */
    async requestInviteOutgoing(request, connectionId, self){

        Logger.debug("Outgoing invite request from client", {
            source: request.headers.pkfpSource,
            cat: "invite"
        });
        const metadata = Metadata.parseMetadata(await self.hm.getLastMetadata(request.headers.pkfpSource));

        if(!Request.isRequestValid(request,
            metadata.getParticipantPublicKey(request.headers.pkfpSource),
            {
                pkfpDest: true,
            })){
            console.error("\nINVITE REQUEST IS INVALID!\n");
        }
        const residenceOrigin = metadata.getParticipantResidence(request.headers.pkfpSource);
        const residenceDest = metadata.getTopicAuthorityResidence();
        const envelope = new Envelope(residenceDest, request, residenceOrigin);
        envelope.setReturnOnFail(true);

        Logger.debug("Sending invite request to TA...", {cat: "invite"})
        await self.crossIslandMessenger.send(envelope, 20000, (envelope)=>{
            Logger.info("INVITE REQUEST TIMEOUT: dest: " + envelope.destination)
            envelope.error = "Invite request timeout. If you have just created the topic, allow some time for invite hidden service to be published and try again. That ususally takes 20sec - 2min.";
            Coordinator.notify(Internal.INVITE_REQUEST_TIMEOUT, envelope);
            self._processStandardClientError(envelope, self);
        });
    }


    /**
     * Accepts invite request and passes it to topic authority
     */
    async requestInviteIncoming(envelope, self){
        //Check request
        Logger.info("Outgoing invite request from client", {
            source: envelope.source,
            dest: envelope.destination
        });
        console.log("invite request incoming! Processing");
        const request =  Request.parse(envelope.payload);
        const ta = self.topicAuthorityManager.getTopicAuthority(request.headers.pkfpDest);
        const response = await ta.processInviteRequest(request);
        const responseEnvelope = new Envelope(envelope.origin, response, envelope.destination);
        await self.crossIslandMessenger.send(responseEnvelope);
    }

    async syncInvitesOutgoing(request, connectionId, self){
        const metadata = Metadata.parseMetadata(await self.hm.getLastMetadata(request.headers.pkfpSource));
        await self.validateOutgoingUserRequest(request);
        const residenceOrigin = metadata.getParticipantResidence(request.headers.pkfpSource);
        const residenceDest = metadata.getTopicAuthorityResidence();
        const envelope = new Envelope(residenceDest, request, residenceOrigin);
        envelope.setReturnOnFail(true);
        await self.crossIslandMessenger.send(envelope, 4000, (envelope)=>{
            envelope.error = "Sync invites request timeout. If you just created your topic or Island has been restarted, allow 20sec - 3min for invite service to publish and try again.";
            Coordinator.notify("sync_invite_timeout", envelope);
            self._processStandardClientError(envelope, self);

        });
    }

    async syncInvitesIncoming(envelope, self){
        Logger.debug("Sync invites outgoing");
        const request = envelope.payload;
        let ta = self.topicAuthorityManager.getTopicAuthority(request.headers.pkfpDest);
        let response = await ta.processInvitesSyncRequest(request);
        let responseEnvelope = new Envelope(envelope.origin, response, envelope.destination)
        responseEnvelope.setResponse();
        await self.crossIslandMessenger.send(responseEnvelope)
    }

    syncInvitesSuccess(envelope, self){
        if(!envelope.errorToken){
            Logger.error("No error token found!")
            return
        }
        let response = envelope.payload;
        self.sessionManager.broadcastUserResponse(response.headers.pkfpSource,
            response);
    }

    async requestInviteSuccess(envelope, self){
        Logger.debug("Invite success received!", {cat: "invite"})

        const response = envelope.payload;
        let session = self.sessionManager.getSessionByTopicPkfp(response.headers.pkfpDest)
        if (session){
            session.broadcast(response);
        } else {
            Logger.warn(`Invite request successful, but no active session found for ${response.headers.pkfpDest}`, {cat: "invite"})
        }
        Coordinator.notify(Events.INVITE_CREATED, envelope);

    }

    async deleteInviteOutgoing(request, connectionId, self){
        await self.validateOutgoingUserRequest(request);
        const metadata = Metadata.parseMetadata(await self.hm.getLastMetadata(request.headers.pkfpSource));
        const residenceOrigin = metadata.getParticipantResidence(request.headers.pkfpSource);
        const residenceDest = metadata.getTopicAuthorityResidence();
        const envelope = new Envelope(residenceDest, request, residenceOrigin);
        envelope.setReturnOnFail(true);
        await self.crossIslandMessenger.send(envelope);
    }

    async deleteInviteIncoming(envelope, self){
        Logger.debug("Delete invite incoming", {cat: "invite"})
        let request = envelope.payload;
        let ta = self.topicAuthorityManager.getTopicAuthority(request.headers.pkfpDest);
        let response = await ta.processDelInviteRequest(request);
        let dest = envelope.origin;
        let orig = envelope.destination
        let responseEnvelope = new Envelope(dest, response, orig)
        await self.crossIslandMessenger.send(responseEnvelope)
    }

    async deleteInviteSuccess(envelope, self){
        Logger.debug("Invite assistant, delete invite success received", {cat: "invite"})
        const response = envelope.payload;

        await self.sessionManager.broadcastMessage(response.headers.pkfpDest,
            response);
    }

    async requestInviteError(envelope, self){
        Logger.debug("Request invite error received.",{
            error: envelope.error,
            cat: "service"
        } ) ;
        await self._processStandardClientError(envelope, self)
    }


    async deleteInviteError(envelope, self){
        Logger.debug("Del invite error")
        await self._processStandardClientError(envelope, self)
    }

    async syncInvitesError(envelope, self){
        Logger.debug("Sync invites error")
        await self._processStandardClientError(envelope, self)
    }

    async _processStandardClientError(envelope, self){

        const originalRequest = Envelope.getOriginalPayload(envelope);                        //
        const pkfpSource = originalRequest.headers.pkfpSource;
        let msg = new Message()
        msg.setCommand(Internal.INVITE_REQUEST_FAIL);
        msg.setSource("island")
        msg.setDest(pkfpSource);
        msg.body.errorMsg = envelope.error;
        let session = self.sessionManager.getSessionByTopicPkfp(pkfpSource);
        if (!session){
            Logger.warn(`Session ${pkfpSource} is not found`)
            return;
        }
        await session.signMessage(msg);
        session.broadcast(msg);
        ///////////////////////////////////////////////////////////////////////////////////////////
        // const originalRequest = Envelope.getOriginalPayload(envelope);                        //
        // const error = new ClientError(originalRequest,                                        //
        //     self.getClientErrorType(originalRequest.headers.command),                         //
        //     envelope.error);                                                                  //
        // self.sessionManager.broadcastUserResponse(originalRequest.headers.pkfpSource, error); //
        ///////////////////////////////////////////////////////////////////////////////////////////
    }


    async validateOutgoingUserRequest(request){
        let self = this;
        const metadata = Metadata.parseMetadata(await self.hm.getLastMetadata(request.headers.pkfpSource));

        if(!Request.isRequestValid(request,
            metadata.getParticipantPublicKey(request.headers.pkfpSource),
            {
                pkfpDest: true,
            })){
            throw new Error("USER REQUEST VALIDATION ERROR");
        }

    }



    /*****************************************************
     * ~END HANDLERS
     *****************************************************/


    /*****************************************************
     * HELPERS
     *****************************************************/
    getClientErrorType(command){
        const errorTypes = {}
        errorTypes[Internal.REQUEST_INVITE] = Internal.INVITE_REQUEST_FAIL;
        errorTypes[Internal.DELETE_INVITE] = Internal.DELETE_INVITE_ERROR;
        errorTypes[Internal.SYNC_INVITES] = Internal.SYNC_INVITES_ERROR;

        if (!errorTypes.hasOwnProperty(command)){
            throw new Error("invalid error type");
        }
        return errorTypes[command];
    }


    subscribeToClientRequests(requestEmitter){
        let handlers = {}
        handlers[Internal.REQUEST_INVITE] = this.requestInviteOutgoing;
        handlers[Internal.DELETE_INVITE] = this.deleteInviteOutgoing;
        handlers[Internal.SYNC_INVITES] = this.syncInvitesOutgoing;
        this.subscribe(requestEmitter, handlers, this.clientErrorHandler)
    }

    subscribeToCrossIslandsMessages(ciMessenger){
        let handlers = {

            request_invite: this.requestInviteIncoming,
            sync_invites: this.syncInvitesIncoming,
            sync_invites_success: this.syncInvitesSuccess,
            return_delete_invite: this.deleteInviteError,
            return_sync_invites: this.syncInvitesError,
            return_request_invite: this.requestInviteError
        }
        handlers[Events.INVITE_CREATED] = this.requestInviteSuccess;
        handlers[Internal.DELETE_INVITE] = this.deleteInviteIncoming;
        handlers[Internal.DELETE_INVITE_SUCCESS] = this.deleteInviteSuccess;


        this.subscribe(ciMessenger, handlers, this.crossIslandErrorHandler)

    }


    handleReturn(envelope){

    }

    /***** Error handlers *****/
    async clientErrorHandler(request, connectionID, self, err){
        console.trace(err);
        try{
            Logger.error(`Client error: ${err.message}`, {cat: "invite"})
            let error = new ClientError(request, self.getClientErrorType(request.headers.command) , "Internal server error")
            self.connectionManager.sendResponse(connectionID, error);
        }catch(fatalError){
            console.log("Some big shit happened: " + fatalError + "\nOriginal error: " + err);
            console.trace(err)
        }
    }


    async crossIslandErrorHandler(envelope, self, err){
        try{
            console.log("Error while handling incoming request");
            let errMsg = err.message || err || "Unknown error";
            Logger.warn(errMsg, {cat: "invite"})
            if(!envelope.return){
                await self.crossIslandMessenger.returnEnvelope(envelope, errMsg);
            }
        }catch(fatalError){
            console.trace("FATAL: Could nod handle the error " + fatalError);
        }
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
            Logger.error(`Invite assistant error on command: ${command} : ${err.message}`, {stack: err.stack, cat: "invite"} )
        }
    }


    /*****************************************************
     * ~END HELPERS
     *****************************************************/









}

module.exports = InviteAssistant;
