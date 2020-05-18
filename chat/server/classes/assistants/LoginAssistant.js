const Request = require("../objects/ClientRequest.js");
const Response = require("../objects/ClientResponse.js");
const Message = require("../objects/Message.js");
const Err = require("../libs/IError.js");
const Metadata = require("../objects/Metadata.js");
const iCrypto = require("../libs/iCrypto.js");
const ClientError = require("../objects/ClientError.js");
const Util = require("../libs/ChatUtility.js");
const Logger = require("../libs/Logger.js");
const Events = require("../../../common/Events").Events;
const Internal = require("../../../common/Events").Internal;






class LoginAssistant{
    constructor(connectionManager = Err.required(),
                requestEmitter = Err.required(),
                historyManager = Err.required(),
                taManager = Err.required(),
                connector = Err.required(),
                clientSessionManager = Err.required(),
                vaultManager = Err.required()){

        this.pendingLogins = {};
        this.connectionManager = connectionManager;
        this.hm = historyManager;
        this.vaultManager = vaultManager;
        this.connector = connector;
        this.sessionManager = clientSessionManager;
        this.setHandlers();
        this.setClientErrorTypes();
        this.subscribe(requestEmitter);
        this.topicAuthorityManager = taManager;
    }


    /*********************************************
     * Handlers
     *********************************************/
    /**
     *
     * @param request
     * @param connectionId
     * @param self
     * @returns {Promise<void>}
     */


    async postLogin(request, connectionId, self){
        Logger.debug(`Processing post login request. Topics: ${JSON.stringify(request.body.topics)}, conn id: ${connectionId}`, {cat: "login"})

        // Verify request
        // Post login should be sent on behalf of vault
        let verified = Request.verify(request, self.vaultManager.getVaultPublicKey(request.headers.pkfpSource));
        Logger.debug(`Verified: ${verified}`, {cat: "login"});

        // Gather encrypted HS private keys and topic authorities

        let session = self.sessionManager.getSessionByConnectionId(connectionId);
        if (!session) throw new Error(`Session has not been initialized for connection ${connectionId}`)

        let topicsData = {};
        if(request.body.topics){
            for (let pkfp of request.body.topics){

                //Adding topic to the session;
                session.addTopic(pkfp);

                Logger.debug(`Getting services data for ${pkfp}`, {cat: "login"});
                let metadata = JSON.parse(await self.hm.getLastMetadata(pkfp));


                topicsData[pkfp] = await self.getDataForDecryption(pkfp, metadata);
                topicsData[pkfp].metadata = metadata;
            }
        } else {
            Logger.warning("NO TOPIC IDs PRESENT IN POST LOGIN", {cat: "login"})
            return;
        }

        Logger.debug(`got data for ${Object.keys(topicsData)}`, {cat: "login"})

        let sessionPublicKey = await session.getPublicKey();

        // Send to client for decryption
        let response = Message.makeResponse(request, "island", Internal.POST_LOGIN_DECRYPT);
        response.body.services = topicsData;
        response.body.sessionKey = sessionPublicKey;
        self.connectionManager.sendMessage(connectionId, response);
    }

    async checkServices(request, connectionId, self){

        Logger.debug(`Received check services request. Checking...`, {cat: "login"})

        //verify request

        let services = request.body.services;
        let session = self.sessionManager.getSessionByConnectionId(connectionId);
        let privateKey = await session.getPrivateKey();

        for(let pkfp of Object.keys(services)){
            let metadata = JSON.parse(await self.hm.getLastMetadata(pkfp));
            Logger.debug(`Checking topic authority`, {cat: "login"})
            if (self.isTopicOwner(pkfp, metadata) && await self.taLaunchRequired(metadata.body.topicAuthority.pkfp)){
                Logger.debug(`Topic autority launch required. Launching`, {cat: "login"})
                const taPkfp = metadata.body.topicAuthority.pkfp;
                const taPrivateKey = Util.decryptStandardMessage(services[pkfp].topicAuthority.taPrivateKey, privateKey);
                const taHSPrivateKey = Util.decryptStandardMessage(services[pkfp].topicAuthority.taHSPrivateKey, privateKey);
                await self.topicAuthorityManager.launchTopicAuthority(taPrivateKey, taHSPrivateKey, taPkfp);
            }

            const residence = metadata.body.participants[pkfp].residence;
            console.log("Checking client hidden service: " + residence, {cat: "login"});
            if (!await self.connector.isHSUp(residence)){
                Logger.debug(`Hidden service ${residence} launch required.`, {cat: "login"})
                const clientHSKey = Util.decryptStandardMessage(services[pkfp].clientHSPrivateKey, privateKey);
                await self.launchClientHS(clientHSKey);
            }

        }
        let response = Message.makeResponse(request, "island", Events.POST_LOGIN_SUCCESS)
        self.connectionManager.sendMessage(connectionId, response);
        Logger.debug(`Services check completed!`, {cat: "login"});
    }

    async getDataForDecryption(clientPkfp, metadata, sessionID){
        let taData, hsKey;
        Logger.debug("Getting data for decryption", {cat: "login"})
        //const pendingLogin = this.getPendingLogin(sessionID);

        if (this.isTopicOwner(clientPkfp, metadata) && await this.taLaunchRequired(metadata.body.topicAuthority.pkfp)){
            console.log("TA launch required");
            const taPkfp = metadata.body.topicAuthority.pkfp;

            taData = {
                taPrivateKey: await this.topicAuthorityManager.getTopicAuthorityPrivateKey(taPkfp),
                taHSPrivateKey: await this.topicAuthorityManager.getTopicAuthorityHSPrivateKey(taPkfp)
            };

        }

        const clientResidence = metadata.body.participants[clientPkfp].residence;
        console.log("Checking client hidden service: " + clientResidence);
        if (!await this.connector.isHSUp(clientResidence)){
            hsKey = await this.hm.getClientHSPrivateKey(clientPkfp);
        }

        return {
                topicAuthority: taData,
                clientHSPrivateKey: hsKey,
        }

    }

    async saveVault(request, connectionId, self){
        console.log("SAVING VAULT!!!")
        let { vault, hash, sign, topics } = request.body
        let id = request.headers.pkfpSource;
        let publicKey = self.vaultManager.getVaultPublicKey(id);
        if (!Request.isRequestValid(request, publicKey)){
            throw new Error("Save vault request signature is not verified.")
        }

        console.log("Updating vault")
        self.vaultManager.updateVaultFormat(id, vault, topics, publicKey,  hash)
        console.log("VAULT UPDATED!");
        let message = Message.makeResponse(request, "island", Events.VAULT_UPDATED)
        message.body = request.body;
        let session = self.sessionManager.getSessionByConnectionId(connectionId);
        session.broadcast(message);
    }

    /*********************************************
     * ~ END Handlers ~
     *********************************************/

    /*********************************************
     * Helper functions
     *********************************************/

    async getSettings(pkfp){
        return this.hm.getClientSettings(pkfp);
    }

    async initSession(request, connectionId, self){
        self.sessionManager.createSession(request.headers.pkfpSource, connectionId, request.body.sessionID);
    }

    async getLastMessages(pkfp){
        return await this.hm.getLastMessagesAndKeys(30, pkfp)
    }

    isTopicOwner(clientPkfp, metadata){
        return metadata.body.owner === clientPkfp;
    }


    async taLaunchRequired(taPkfp) {
        return  !(this.topicAuthorityManager.isTopicAuthorityLaunched(taPkfp) &&
            await this.topicAuthorityManager.isTaHiddenServiceOnline(taPkfp));
    }

    /**
     * Assumes that topic authority is local
     * @param pkfp
     * @param self
     * @returns {Promise<{taPrivateKey: *, topicHSPrivateKey: *}>}
     */
    async getTopicAuthorityData(pkfp, self){
        let taPrivateKey = await self.hm.getTopicKey(pkfp, "taPrivateKey")
        let topicHSPrivateKey = await self.hm.getTopicKey(pkfp, "taHSPrivateKey")
        return {
            taPrivateKey: taPrivateKey,
            taHSPrivateKey: topicHSPrivateKey
        }
    }


    generateDecryptionToken(){
        const ic = new iCrypto();
        ic.asym.createKeyPair("kp", 1024);
        return ic.get("kp");
    }


    deletePendingLogin(sessionID){
        if (!this.pendingLogins.hasOwnProperty(sessionID)){
            throw new Error("Pending login not found");
        }

        delete this.pendingLogins[sessionID];
    }

    async verifyLoginRequest(request){
        const clientPublicKey = await this.hm.getOwnerPublicKey(request.headers.pkfpSource);
        Request.isRequestValid(request, clientPublicKey);
    }

    async launchClientHS(privateKey = Err.required()){
        await this.connector.createHiddenService(privateKey);
    }

    async setPendingLogin(request){
        const clientPublicKey = this.hm.getOwnerPublicKey(request.headers.pkfpSource);
        const metadata = Metadata.parseMetadata(await this.hm.getLastMetadata(request.headers.pkfpSource));
        const pendingLogin = {
            publicKey: clientPublicKey,
            metadata: metadata,
            request: request
        };

        this.pendingLogins[request.body.sessionID] = pendingLogin;
    }

    getPendingLogin(sessionID){
        if (!this.pendingLogins.hasOwnProperty(sessionID)){
            throw new Error("Pending login not found");
        }

        return this.pendingLogins[sessionID];
    }

    setClientErrorTypes(){
        this.clientErrorTypes = {};
        Object.keys(this.handlers).forEach((val)=>{
            this.clientErrorTypes[val] = Events.LOGIN_ERROR;
        })
    }

    getErrorType(command){
        if(!this.clientErrorTypes[command]){
            throw new Error("Error tpye not found!");
        }
        return this.clientErrorTypes[command]
    }

    subscribe(requestEmitter){
        let self = this;
        Object.keys(self.handlers).forEach((val)=>{
            requestEmitter.on(val, async (request, connectionId)=>{
                await self.handleRequest(request, connectionId, self);
            })
        });
    }

    setHandlers(){
        this.handlers = {}
        this.handlers[Internal.POST_LOGIN] = this.postLogin;
        this.handlers[Internal.POST_LOGIN_CHECK_SERVICES] = this.checkServices;
        this.handlers[Internal.SAVE_VAULT] = this.saveVault;
    }

    async handleRequest(request, connectionId, self){
        try{
            console.log(`Processing login topic request: ${request.headers.command}`);
            await this.handlers[request.headers.command](request, connectionId, self)
        }catch(err){
            //handle error
            Logger.warn("Topic login error", {
                error: err.message,
                cat: "login",
                pkfp: request.pkfp,
                connectionId: connectionId,
                stack: err.stack
            });

            try{
                let error = new ClientError(request, this.getErrorType(request.headers.command) , err.message)
                this.connectionManager.sendResponse(connectionId, error);
            }catch(fatalError){
                Logger.error("Topic login assistant FATAL ERROR", {
                    connectionId: connectionId,
                    request: JSON.stringify(request),
                    cat: "login",
                    error: fatalError.message,
                    context: fatalError.stack,
                    originalError: err.message
                })

            }


        }
    }


    /*********************************************
     * ~ End helper Functions
     *********************************************/


    ///JUNK
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // async initLogin(request, connectionId, self) {                                                                                        //
    //     const clientPkfp = request.headers.pkfpSource;                                                                                    //
    //     test                                                                                                                              //
    //                                                                                                                                       //
    //     await self.verifyLoginRequest(request);                                                                                           //
    //     await self.setPendingLogin(request);                                                                                              //
    //     const pendingLogin = self.getPendingLogin(request.body.sessionID);                                                                //
    //     const metadata = pendingLogin.metadata;                                                                                           //
    //     const dataForDecryption = await self.getDataForDecryption(clientPkfp, metadata, request.body.sessionID);                          //
    //                                                                                                                                       //
    //     if (pendingLogin.taLaunchRequired || pendingLogin.hsLaunchRequired) {                                                             //
    //         await self.sendToClientForDecrytpion(dataForDecryption, request, connectionId);                                               //
    //     } else {                                                                                                                          //
    //         await self.finalizeLogin(request, connectionId, self);                                                                        //
    //     }                                                                                                                                 //
    //                                                                                                                                       //
    // }                                                                                                                                     //
    //                                                                                                                                       //
    // async continueAfterDecryption(request, connectionId, self){                                                                           //
    //     const pendingLogin = self.getPendingLogin(request.body.sessionID);                                                                //
    //     if(!pendingLogin){                                                                                                                //
    //         throw new Error("Login was not properly initialized");                                                                        //
    //     }                                                                                                                                 //
    //     const tokenPrivateKey = pendingLogin.token.privateKey;                                                                            //
    //     if (pendingLogin.hsLaunchRequired){                                                                                               //
    //         const clientHSKey = Util.decryptStandardMessage(request.body.preDecrypted.clientHSPrivateKey, tokenPrivateKey);               //
    //         await self.launchClientHS(clientHSKey)                                                                                        //
    //     }                                                                                                                                 //
    //                                                                                                                                       //
    //     if (pendingLogin.taLaunchRequired){                                                                                               //
    //         const taPkfp = pendingLogin.metadata.body.topicAuthority.pkfp;                                                                //
    //         const taPrivateKey = Util.decryptStandardMessage(request.body.preDecrypted.topicAuthority.taPrivateKey, tokenPrivateKey);     //
    //         const taHSPrivateKey = Util.decryptStandardMessage(request.body.preDecrypted.topicAuthority.taHSPrivateKey, tokenPrivateKey); //
    //         await self.topicAuthorityManager.launchTopicAuthority(taPrivateKey, taHSPrivateKey, taPkfp);                                  //
    //     }                                                                                                                                 //
    //                                                                                                                                       //
    //                                                                                                                                       //
    //     self.finalizeLogin(request, connectionId, self);                                                                                  //
    //                                                                                                                                       //
    // }                                                                                                                                     //
    //                                                                                                                                       //
    // sendToClientForDecrytpion(dataForDecryption, request, connectionId){                                                                  //
    //     console.log("Sending to client for decryption");                                                                                  //
    //     const token = this.generateDecryptionToken();                                                                                     //
    //     const response = new Response("login_decryption_required", request);                                                              //
    //     response.body.dataForDecryption = dataForDecryption;                                                                              //
    //     response.body.token = token.publicKey;                                                                                            //
    //     this.getPendingLogin(request.body.sessionID).token = token;                                                                       //
    //     this.connectionManager.sendResponse(connectionId, response);                                                                      //
    // }                                                                                                                                     //
    //                                                                                                                                       //
    // async finalizeLogin(request, connectionId, self){                                                                                     //
    //     if(!self.pendingLogins[request.body.sessionID]){                                                                                  //
    //         throw new Error("Login was not properly initialized");                                                                        //
    //     }                                                                                                                                 //
    //     await self.initSession(request, connectionId, self);                                                                              //
    //     const messages = await self.getLastMessages(request.headers.pkfpSource);                                                          //
    //     const settings = await self.getSettings(request.headers.pkfpSource);                                                              //
    //                                                                                                                                       //
    //     const response = new Response("login_success", request);                                                                          //
    //     response.body.messages = messages;                                                                                                //
    //     response.body.metadata = self.pendingLogins[request.body.sessionID].metadata;                                                     //
    //     response.body.settings = settings;                                                                                                //
    //                                                                                                                                       //
    //     self.connectionManager.sendResponse(connectionId, response);                                                                      //
    //                                                                                                                                       //
    //     this.deletePendingLogin(request.body.sessionID);                                                                                  //
    // }                                                                                                                                     //
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ///JUNK END


}

module.exports = LoginAssistant;
