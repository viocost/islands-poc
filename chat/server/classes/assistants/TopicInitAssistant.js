const iCrypto = require("../libs/iCrypto.js");
const Response = require("../objects/ClientResponse.js");
const Request = require("../objects/ClientRequest.js");
const Message = require("../objects/Message.js");
const ClientError = require("../objects/ClientError.js");
const Utility = require("../libs/ChatUtility.js");
const Err = require("../libs/IError.js");
const ChatEvents = require("../../../common/Events.js").Events;
const Internal = require("../../../common/Events.js").Internal;
const Logger = require("../libs/Logger.js");


class TopicInitAssistant{

    constructor(connectionManager = Err.required(),
                requestEmitter = Err.required(),
                historyManager = Err.required(),
                topicAuthorityManager = Err.required(),
                torConnector = Err.required(),
                vaultManager = Err.required(),
                sessionManager = Err.required()){

        this.connector = torConnector;
        this.newTopicPending = {};
        this.connectionManager = connectionManager;
        this.hm = historyManager;
        this.topicAuthorityManager = topicAuthorityManager;
        this.vaultManager = vaultManager;
        this.sessionManager = sessionManager;

        this.setHandlers();
        this.setEventsHandled();
        this.setClientErrorTypes();
        Logger.debug("About to call subscribe", {cat: "chat"});
        this.subscribe(requestEmitter);

    }


    /*********************************************
     * Handlers
     *********************************************/


    /**
     * Client request to initialize the topic
     * Client must have send all the required information to initalize first metadata,
     * in particular: nickname, topic name, client public key, topic private key.
     *
     * This routine must create 2 Hidden services - 1 for the client,
     * another for the topic authority.
     *
     * Private keys for both services must be encrypted with CLIENT PUBLIC KEY!
     * Topic private key must also be encrypted with client public key
     *
     * all 3 encrypted private keys must be stored on disk
     *
     * then first metadata must be appended to the newly created history file
     * and topic authority initialized
     *
     * @param request
     * @param connectionId
     * @param self
     */
    async initTopic(request, connectionId, self){

        //self.initTopicVerifyRequest(request);
        let vaultPublicKey = self.vaultManager.getVaultPublicKey(request.headers.pkfpSource)
        if(!Message.verify(request, vaultPublicKey)){
            throw new Error("Init topic request is invalid");
        }

        Logger.debug("Init toipc request verified", {cat: "topic_create"})
        //const newTopicPending = self.getNewTopicPendingData(request.body.topicID);
        let session = self.sessionManager.getSessionByConnectionId(connectionId);
        const newTopicRequest = request.body.newTopicData;

        const newTopicData = JSON.parse(await session.decryptMessage(newTopicRequest));

        const topicKeyPair = newTopicData.topicKeyPair;
        const ownerPublicKey = newTopicData.ownerPublicKey;

        const torResponse = await self.prepareHiddenService(self);

        const clientResidence = torResponse.serviceID.substring(0, 16) + ".onion";
        const clientHsPrivateKey = torResponse.privateKey;
        const clientHsPrivateKeyCip = Utility.encryptStandardMessage(clientHsPrivateKey, request.body.ownerPublicKey);

        //Create topic directory
        await self.hm.initTopic(request.body.topicPkfp,
            request.body.ownerPublicKey,
            clientHsPrivateKeyCip
        );

        Logger.debug("Topic initialized", {cat: "topic_create"})
        //const newTopicPending = self.getNewTopicPendingData(request.body.topicID);
        //Initializing and saving new topic authority
        const taPkfp = await self.topicAuthorityManager.createTopicAuthority(
            request.body.topicPkfp,
            ownerPublicKey,
            clientResidence,
            topicKeyPair.privateKey);

        Logger.debug("Topic authority initialized", {cat: "topic_create"})
        const metadata = self.topicAuthorityManager.getTopicAuthority(taPkfp).getCurrentMetadata();
        metadata.body.settings = request.body.settings;
        //Persist first metadata to history
        await self.hm.initHistory(request.body.topicPkfp, JSON.stringify(metadata));

        //Deleting new pending topic token

        //TODO Save new topic vault record

        Logger.debug("Saving vault", {cat: "topic_create"})
        await self.vaultManager.saveTopic(request.headers.pkfpSource,
                                    request.body.topicPkfp,
                                    request.body.vaultRecord)

        //return success
        //
        Logger.debug("Topic created. Norifying client", {cat: "topic_create"})

        let response = Message.makeResponse(request, "island", Internal.TOPIC_CREATED);
        response.body.metadata = metadata;
        response.body.vaultRecord = request.body.vaultRecord;
        response.body.topicPkfp = request.body.topicPkfp;
        session.addTopic(request.body.topicPkfp);
        session.send(response, connectionId);
    }

    /**
     * This is the first step to initialize a new topic
     * Client requests to generate 1-time-key to pass along new topic data
     * this function generates the token, saves it RAM
     * for future processing and responses with new token
     * @param request
     * @param socket
     * @param self
     */
    async createToken(request, connectionId, self){
        //Create token
        console.log("TopicInit: create token called");
        request = Request.parse(request);

        //Error check
        if(!request.hasAttribute("topicID")){
            throw new Error("Topic id is required");
        } else if(!request.hasAttribute("ownerPublicKey")){
            throw new Error("Owner public key is required");
        }

        let session = self.sessionManager.getSessionByConnectionId(connectionId);
        let publicKey = await session.getPublicKey();

        //Saving pending request
        let pendingTopic = {
            topicID: request.body.topicID,
            ownerPublicKey: request.body.ownerPublicKey,
        };

        self.setNewTopicPending(pendingTopic);

        let response = new Response(Internal.INIT_TOPIC_TOKEN, request);

        response.setAttribute("token", publicKey);
        self.connectionManager.sendResponse(connectionId, response);
    }
    /*********************************************
     * ~ END Handlers ~
     *********************************************/



    /*********************************************
     * Helper functions
     *********************************************/



    getErrorType(command){
        if(!this.clientErrorTypes[command]){
            throw new Error("Error tpye not found!");
        }
        return this.clientErrorTypes[command];
    }


    setHandlers(){
        this.handlers = {};
        this.handlers[Internal.INIT_TOPIC_GET_TOKEN] = this.createToken;
        this.handlers[Internal.INIT_TOPIC] = this.initTopic;
    }


    setEventsHandled(){
        this.eventsHandled = [
            Internal.INIT_TOPIC_GET_TOKEN,
            Internal.INIT_TOPIC
        ];
    }

    setClientErrorTypes(){
        this.clientErrorTypes = {};
        this.eventsHandled.forEach((val)=>{
            this.clientErrorTypes[val] = ChatEvents.INIT_TOPIC_ERROR;
        });
    }

    subscribe(requestEmitter){
        console.log("In subscribe");
        let self = this;
        Logger.debug(`Events handled: ${JSON.stringify(this.eventsHandled)}`, {cat: "chat"})
        self.eventsHandled.forEach((val)=>{
            requestEmitter.on(val, async (request, connectionId)=>{
                await self.handleRequest(request, connectionId, self);
            });
        });
    }

    async handleRequest(request, connectionId, self){
        try{

            await this.handlers[request.headers.command](request, connectionId, self);
        }catch(err){
            //handle error
            try{
                Logger.error(`Topic init assistant error: ${err.message}`, {stack: err.stack, cat: "topic_create"} );
                let error = new ClientError(request, this.getErrorType(request.headers.command) , `Topic init error: ${err.message}`);
                this.connectionManager.sendMessage(connectionId, error);
            }catch(fatalError){
                Logger.error(`Topic init assistant FATAL ERROR: ${fatalError.message}`, {stack: fatalError.stack, cat: "topic_create"} );
            }
        }
    }

    initTopicVerifyRequest(request){
        if(!this.newTopicPending[request.body.topicID]){
            throw new Error("Pending topic data not found");
        }

        if(!request.body.newTopicData){
            throw new Error("Missing new topic data");
        }
    }

    getNewTopicPendingData(topicId){
        return this.newTopicPending[topicId]
    }

    async prepareHiddenService(self){
        return self.connector.createHiddenService()
    }

    setNewTopicPending(data){
        this.newTopicPending[data.topicID] = data;
    }
    /*********************************************
     * ~ End helper Functions
     *********************************************/
}


module.exports = TopicInitAssistant;
