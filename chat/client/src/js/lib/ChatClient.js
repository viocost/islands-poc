import { WildEmitter } from "./WildEmitter";
import { Events, Internal } from "../../../../common/Events";
import { assert } from "../../../../common/IError";
import { Vault } from "./Vault"
import { XHR } from "./xhr";
import { Connector } from "./Connector";
import { MessageQueue } from  "./MessageQueue";
import { ArrivalHub } from "./ArrivalHub";
import  { ChatUtility }  from "./ChatUtility";
import { Message } from "./Message";
import { Topic } from "./Topic";
import { DownloadAttachmentAgent } from "./DownloadAttachmentAgent";
import { iCrypto } from "./iCrypto"
import { TopicJoinAgent } from "./TopicJoinAgent";
import { SendMessageAgent } from "./SendMessageAgent";
import { BootParticipantAgent } from "./BootParticipantAgent";

export class ChatClient{
    constructor(opts){
        WildEmitter.mixin(this);
        if(!opts.version){
            throw new Error("Version required!");
        }
        if (opts.test){
            this.connectionString = opts.connectionString;
        }
        this.version = opts.version;
        this.vault;
        this.topics;
        this.messageQueue;
        this.connector;
        this.arrivalHub;
        this.sessionKey;
        this.agents = [];
    }

    // ---------------------------------------------------------------------------------------------------------------------------
    // Login and session initialization
    initSession(password){
        setImmediate(async ()=>{
            try{
                if (!password){
                    throw new Error("Password is missing.")
                }
                console.log("Initializing session");
                let response = await this.getVault();

                let { vault, vaultId } = response;
                if (!vault){
                    throw new Error("Vault not found")
                }

                let vaultObj = new Vault()
                await vaultObj.initSaved(this.version, vault.vault, password, vault.topics)
                this.vault = vaultObj;
                console.log("Got vault. Initializing");
                //Initialize vault

                // Initialize multiplexor socket
                this.connector = new Connector();
                this.setConnectorListeners()

                //Initializing arrival hub
                this.arrivalHub = new ArrivalHub(this.connector);

                //Initialize message queue
                this.messageQueue = new MessageQueue(this.connector);


                this.vault.setId(vaultId);
                console.log("Vault initialized. Initializing connector...");


                console.log("Bootstrapping vault...");
                //bootstrapping vault
                await this.vault.bootstrap(this.arrivalHub, this.messageQueue, this.version);


                console.log("Setting listeneres");
                this.setVaultListeners()

                console.log("Establishing connection");
                await this.connector.establishConnection(vaultId);
                console.log("Connection established. Initializing arrival hub..");


                console.log(`Initializing topic listeners...`);
                this.topics = this.vault.topics;
                for(let pkfp of Object.keys(this.topics)){
                    this.topics[pkfp].bootstrap(this.messageQueue, this.arrivalHub, this.version);
                    this.initTopicListeners(this.topics[pkfp])
                }

                //At this point we have loaded all topic keys, so login is successful
                this.emit(Events.LOGIN_SUCCESS)

                // Post-login
                this.postLogin();
            } catch (err){
                let errMsg = `Login error: ${err}. \nCheck connection and entered password and try again.`
                console.log(errMsg);
                this.emit(Events.LOGIN_ERROR, new Error(errMsg));
                throw new Error(errMsg);
            }
        })
    }

    setVaultListeners(){
        let self = this
        this.vault.on(Internal.SESSION_KEY, (message)=>{
            this.sessionKey = message.body.sessionKey;
            console.log("Session key is set!")
        })
        this.vault.on(Events.TOPIC_CREATED, (pkfp)=>{
            self.initTopicListeners(self.topics[pkfp])
            self.emit(Events.TOPIC_CREATED, pkfp);
        })

        this.vault.on(Internal.TOPIC_DELETED, (pkfp)=>{
            self.emit(Events.TOPIC_DELETED, pkfp);
        })


        this.vault.on(Events.VAULT_UPDATED, ()=>{
            console.log("Vault updated in chat client");
            self.emit(Events.VAULT_UPDATED);
        })
    }

    setConnectorListeners(){
        this.connector.on(Internal.CONNECTION_STATE_CHANGED, state => {
            console.log(`Island connection state changed: ${state}`);
            this.emit(Events.CONNECTION_STATUS_CHANGED, state);
        })
    }

    getConnectionState(){
        return this.connector.state;
    }

    // Sends all topic pkfps (ids) to gather metadata and encrypted services
    postLogin(){
        //sending post_login request
        let message = new Message(this.version);
        message.setSource(this.vault.id);
        message.setCommand(Internal.POST_LOGIN);
        message.addNonce();
        message.body.topics = Object.keys(this.topics);
        message.signMessage(this.vault.privateKey);
        this.vault.once(Internal.POST_LOGIN_DECRYPT, (msg)=>{
            this.postLoginDecrypt(msg, this);
        })
        this.messageQueue.enqueue(message);
    }

    // Decrypts topic authorities' and hidden services keys
    // and re-encrypts them with session key, so island can poke all services
    postLoginDecrypt(msg, self){
        console.log(`Got decrypt command from server.`)
        //decrypting and sending data back

        let decryptBlob = (privateKey, blob, lengthChars = 4)=>{
            let icn = new iCrypto();
            let symLength = parseInt(blob.substr(-lengthChars))
            let blobLength = blob.length;
            let symk = blob.substring(blobLength- symLength - lengthChars, blobLength-lengthChars );
            let cipher = blob.substring(0, blobLength- symLength - lengthChars);
            icn.addBlob("symcip", symk)
                .addBlob("cipher", cipher)
                .asym.setKey("priv", privateKey, "private")
                .asym.decrypt("symcip", "priv", "sym", "hex")
                .sym.decrypt("cipher", "sym", "blob-raw", true)
            return icn.get("blob-raw")
        };

        let encryptBlob = (publicKey, blob, lengthChars = 4)=>{
            let icn = new iCrypto();
            icn.createSYMKey("sym")
                .asym.setKey("pub", publicKey, "public")
                .addBlob("blob-raw", blob)
                .sym.encrypt("blob-raw", "sym", "blob-cip", true)
                .asym.encrypt("sym", "pub", "symcip", "hex")
                .encodeBlobLength("symcip", 4, "0", "symcipl")
                .merge(["blob-cip", "symcip", "symcipl"], "res")
            return icn.get("res");
        };

        let services = msg.body.services;
        let sessionKey = msg.body.sessionKey;
        let res = {}
        for (let pkfp of Object.keys(services)){
            let topicData = services[pkfp];
            let topicPrivateKey = self.topics[pkfp].privateKey;

            let clientHSPrivateKey, taHSPrivateKey, taPrivateKey;

            if (topicData.clientHSPrivateKey){
                clientHSPrivateKey = decryptBlob(topicPrivateKey, topicData.clientHSPrivateKey)
            }

            if (topicData.topicAuthority && topicData.topicAuthority.taPrivateKey){
                taPrivateKey = decryptBlob(topicPrivateKey, topicData.topicAuthority.taPrivateKey )
            }

            if (topicData.topicAuthority && topicData.topicAuthority.taHSPrivateKey){
                taHSPrivateKey = decryptBlob(topicPrivateKey, topicData.topicAuthority.taHSPrivateKey)
            }

            self.topics[pkfp].loadMetadata(topicData.metadata);

            let preDecrypted = {};

            if (clientHSPrivateKey){
                preDecrypted.clientHSPrivateKey = encryptBlob(sessionKey, clientHSPrivateKey)
            }
            if (taPrivateKey || taHSPrivateKey){
                preDecrypted.topicAuthority = {}
            }
            if (taPrivateKey){
                preDecrypted.topicAuthority.taPrivateKey = encryptBlob(sessionKey, taPrivateKey)
            }
            if (taHSPrivateKey){
                preDecrypted.topicAuthority.taHSPrivateKey = encryptBlob(sessionKey, taHSPrivateKey)
            }

            res[pkfp] = preDecrypted
        }

        console.log("Decryption is successfull.");
        let message = new Message(self.version);
        message.setCommand(Internal.POST_LOGIN_CHECK_SERVICES)
        message.setSource(self.vault.getId());
        message.body.services = res;
        message.signMessage(self.vault.privateKey);
        self.vault.once(Events.POST_LOGIN_SUCCESS, ()=>{
            console.log("Post login success!");
            self.emit(Events.POST_LOGIN_SUCCESS)
        })
        
        this.messageQueue.enqueue(message);

    }

    initTopicListeners(topic){
        topic.on(Events.MESSAGES_LOADED, (messages)=>{
            this.emit(Events.MESSAGES_LOADED, {pkfp: topic.pkfp, messages: messages})
        })

        topic.on(Events.INVITE_CREATED, (inviteCode)=>{
            this.emit(Events.INVITE_CREATED, {pkfp: topic.pkfp, inviteCode: inviteCode})
        })

        topic.on(Events.NEW_CHAT_MESSAGE, (msg, pkfp)=>{
            this.emit(Events.NEW_CHAT_MESSAGE, msg, topic.pkfp);
        })

        topic.on(Events.METADATA_UPDATED, ()=>{
            this.emit(Events.METADATA_UPDATED, topic.pkfp);
        })

        topic.on(Events.SETTINGS_UPDATED, ()=>{
            this.emit(Events.SETTINGS_UPDATED, topic.pkfp);
        })

        ///////////////////////////////////////////////////////////
        // topic.on(Events.NICKNAME_CHANGED, (data)=>{           //
        //     this.emit(Events.NICKNAME_CHANGED, data)          //
        // })                                                    //
        //                                                       //
        // topic.on(Events.PARTICIPANT_ALIAS_CHANGED, (data)=>{  //
        //     this.emit(Events.PARTICIPANT_ALIAS_CHANGED, data) //
        // })                                                    //
        //                                                       //
        // topic.on(Events.INVITE_ALIAS_CHANGED, (data)=>{       //
        //     this.emit(Events.INVITE_ALIAS_CHANGED, data)      //
        // })                                                    //
        ///////////////////////////////////////////////////////////
    }
    //END//////////////////////////////////////////////////////////////////////


    // ---------------------------------------------------------------------------------------------------------------------------
    // Invite handling

    requestInvite(topicId){
        if (!this.topics.hasOwnProperty(topicId)) throw new Error(`Topic ${topicId}, not found`)
        let topic = this.topics[topicId];
        topic.requestInvite();

    }

    deleteInvite(topicId, inviteCode){
        if (!this.topics.hasOwnProperty(topicId)) throw new Error(`Topic ${topicId}, not found`)
        let topic = this.topics[topicId];
        topic.deleteInvite(inviteCode);
    }

    getInvites(topicId){
        assert(this.topics.hasOwnProperty(topicId), `Topic ${topicId}, not found`)
        return this.topics[topicId].getInvites();
    }

    // ---------------------------------------------------------------------------------------------------------------------------
    // Topic creation


    initTopic(nickname, topicName){
        let self = this;
        setTimeout(async ()=>{
            console.log("Checking input");
            nickname = String(nickname).trim();
            if (!nickname || !/^.{2,20}$/.test(nickname)){
                self.emit(Events.INIT_TOPIC_ERROR,
                            `Nickname entered is invalid`);
                return;
            }
            if(!/^.{0,20}$/.test(topicName)){
                self.emit(Events.INIT_TOPIC_ERROR,
                            `Topic name entered is invalid`);
                return;
            }

            console.log("Generating keys");
            //CREATE NEW TOPIC PENDING
            let ic = new iCrypto();

            //Generate keypairs one for user, other for topic
            ic = await ic.asym.asyncCreateKeyPair('owner-keys');
            ic = await ic.asym.asyncCreateKeyPair('topic-keys');
            ic.getPublicKeyFingerprint("owner-keys", "owner-pkfp");
            ic.getPublicKeyFingerprint("topic-keys", "topic-pkfp");

            let ownerKeyPair  = ic.get("owner-keys")
            let topicKeyPair  = ic.get("topic-keys")
            let ownerPkfp  = ic.get("owner-pkfp")
            let topicID  = ic.get("topic-pkfp")

            //Forming request
            let newTopicData = {
                topicKeyPair: topicKeyPair,
                ownerPublicKey: ownerKeyPair.publicKey
            };

            console.log("Preparing request");
            let newTopicDataCipher = ChatUtility.encryptStandardMessage(JSON.stringify(newTopicData), self.sessionKey);

            //initializing topic settings
            let settings = Topic.prepareNewTopicSettings(self.version, nickname, topicName, ownerKeyPair.publicKey)

            // TODO Prepare new topic vault record
            let vaultRecord = self.vault.prepareVaultTopicRecord(this.version,
                                                                ownerPkfp,
                                                                ownerKeyPair.privateKey,
                                                                topicName)

            //Preparing request
            let request = new Message(self.version);
            request.headers.command = Internal.INIT_TOPIC;
            request.headers.pkfpSource = self.vault.id;
            request.body.topicID = topicID;
            request.body.topicPkfp = ownerPkfp;
            request.body.settings = settings;
            request.body.ownerPublicKey = ownerKeyPair.publicKey;
            request.body.newTopicData = newTopicDataCipher;
            request.body.vaultRecord = vaultRecord;
            request.body.vaultId = self.vault.id;
            request.signMessage(self.vault.privateKey)

            self.messageQueue.enqueue(request)

        }, 50)
    }

    //~END INIT TOPIC//////////////////////////////////////////////////////////



    // ---------------------------------------------------------------------------------------------------------------------------
    // DELETE TOPIC, LEAVE
    deleteTopic(pkfp){
        let self = this
       
        // let privateKey = this.session.privateKey;
        let topic = this.vault.topics[pkfp]
        if (!topic) throw new Error(`Topic ${pkfp} not found`);

        let ic = new iCrypto();
        ic.createNonce("n")
            .bytesToHex("n", "nhex")
            .setRSAKey("priv", self.vault.privateKey, "private")
            .privateKeySign("nhex", "priv", "sign")

        let request = new Message(self.version);
        request.setCommand(Internal.DELETE_TOPIC);
        request.setSource(self.vault.id);
        request.body.vaultId = self.vault.id;
        request.body.topicPkfp = pkfp;
        request.body.vaultNonce = ic.get("nhex")
        request.body.vaultSign = ic.get("sign")
        request.addNonce();
        request.signMessage(topic.getPrivateKey());
        self.messageQueue.enqueue(request);
    }


    leaveTopic(pkfp, deleteHistory = true){

        let self = this

        // let privateKey = this.session.privateKey;
        let topic = this.vault.topics[pkfp]
        assert(topic, `Topic ${pkfp} not found`)

        let ic = new iCrypto();
        ic.createNonce("n")
            .bytesToHex("n", "nhex")
            .setRSAKey("priv", self.vault.privateKey, "private")
            .privateKeySign("nhex", "priv", "sign")

        let request = new Message(self.version);
        request.setCommand(Internal.LEAVE_TOPIC);
        request.setSource(self.vault.id);
        request.body.vaultId = self.vault.id;
        request.body.topicPkfp = pkfp;
        request.body.deleteHistory = deleteHistory;
        request.body.vaultNonce = ic.get("nhex")
        request.body.vaultSign = ic.get("sign")
        request.addNonce();
        request.signMessage(topic.getPrivateKey());
        self.messageQueue.enqueue(request);
    }

    //~END DELETE TOPIC////////////////////////////////////////////////////////


    // ---------------------------------------------------------------------------------------------------------------------------
    // BOOT PARTICIPANT

    bootParticipant(topicPkfp, participantPkfp){
        let topic = this.topics[topicPkfp.trim()];
        assert(topic, `No topic found: ${topicPkfp}`);
        assert(topic.hasParticipant(participantPkfp.trim()), `No participant found: ${participantPkfp}`)
        let bootAgent = new BootParticipantAgent(topic, participantPkfp, this.messageQueue)
        console.log("Proceeding participant boot");
        bootAgent.boot();
    }

    // ---------------------------------------------------------------------------------------------------------------------------
    // TOPIC JOIN

    /**
     * Called on INVITEE side when new user joins a topic with an invite code
     * @param nickname
     * @param inviteCode
     * @returns {Promise}
     */
    async joinTopic(nickname, topicName, inviteString) {
        let topicJoinAgent = new TopicJoinAgent(nickname, topicName, inviteString, this.arrivalHub, this.messageQueue, this.vault);
        let self = this;
        topicJoinAgent.on(Internal.JOIN_TOPIC_SUCCESS, (data)=>{
            // data is object: { pkfp: pkfp, nickname: nickname }
            self.initTopicListeners(self.topics[data.pkfp])
            self.emit(Events.TOPIC_JOINED, data)
        })
        topicJoinAgent.on(Internal.JOIN_TOPIC_FAIL, ()=>{ console.log("Join topic fail received from the agent")})
        topicJoinAgent.start()


        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // setTimeout(()=>{                                                                                                                  //
        //                                                                                                                                   //
        //     let start = new Date();                                                                                                       //
        //     console.log("joining topic with nickname: " + nickname + " | Invite code: " + inviteCode);                                    //
        //                                                                                                                                   //
        //     console.log(`Preparing keys...`);                                                                                             //
        //                                                                                                                                   //
        //     let cryptoStart = new Date()                                                                                                  //
        //     let ic = new iCrypto();                                                                                                       //
        //     ic.asym.createKeyPair("rsa")                                                                                                  //
        //         .getPublicKeyFingerprint('rsa', 'pkfp')                                                                                   //
        //         .addBlob("invite64", inviteCode.trim())                                                                                   //
        //         .base64Decode("invite64", "invite");                                                                                      //
        //                                                                                                                                   //
        //     let pkfp = ic.get("pkfp")                                                                                                     //
        //     let publicKey = ic.get("rsa").publicKey;                                                                                      //
        //     let privateKey = ic.get("rsa").privateKey;                                                                                    //
        //                                                                                                                                   //
        //     let now = new Date()                                                                                                          //
        //                                                                                                                                   //
        //     console.log(`Keys generated in ${(now - cryptoStart) / 1000}sec. ${ (now - start) / 1000 } elapsed since beginning.`);        //
        //                                                                                                                                   //
        //     let callStart = new Date()                                                                                                    //
        //                                                                                                                                   //
        //                                                                                                                                   //
        //     let invite = ic.get("invite").split("/");                                                                                     //
        //     let inviterResidence = invite[0];                                                                                             //
        //     let inviterID = invite[1];                                                                                                    //
        //     let inviteID = invite[2];                                                                                                     //
        //                                                                                                                                   //
        //     ///////////////////////////////////////////////////////////////////////////                                                   //
        //     // if (!self.inviteRequestValid(inviterResidence, inviterID, inviteID)){ //                                                   //
        //     //     self.emit("join_topic_fail");                                     //                                                   //
        //     //     throw new Error("Invite request is invalid");                     //                                                   //
        //     // }                                                                     //                                                   //
        //     ///////////////////////////////////////////////////////////////////////////                                                   //
        //                                                                                                                                   //
        //     if(!inviteID || !inviterID || !(/^[a-z2-7]{16}\.onion$/.test(inviterResidence)))                                              //
        //         throw new error("Invite request is invalid")                                                                              //
        //                                                                                                                                   //
        //     // Encrypted vault record                                                                                                     //
        //     console.log(`Topic name is: ${topicName}`);                                                                                   //
        //     let vaultRecord = self.vault.prepareVaultTopicRecord(self.version,                                                            //
        //                                                         pkfp,                                                                     //
        //                                                         privateKey,                                                               //
        //                                                         topicName)                                                                //
        //     let vault = JSON.stringify({                                                                                                  //
        //         record: vaultRecord,                                                                                                      //
        //         id: self.vault.id                                                                                                         //
        //     })                                                                                                                            //
        //                                                                                                                                   //
        //     ic.addBlob("vlt-rec", vault)                                                                                                  //
        //     .setRSAKey("priv", self.vault.privateKey, "private")                                                                          //
        //     .privateKeySign("vlt-rec", "priv", "vlt-sign")                                                                                //
        //                                                                                                                                   //
        //                                                                                                                                   //
        //     let request = new Message(self.version);                                                                                      //
        //     request.setCommand(Internal.JOIN_TOPIC);                                                                                      //
        //     request.setSource(pkfp);                                                                                                      //
        //     request.setDest(inviterID);                                                                                                   //
        //     let body = {                                                                                                                  //
        //         inviteString: inviteCode.trim(),                                                                                          //
        //         inviteCode: inviteID,                                                                                                     //
        //         destination: inviterResidence,                                                                                            //
        //         invitee:{                                                                                                                 //
        //             publicKey: publicKey,                                                                                                 //
        //             pkfp: pkfp                                                                                                            //
        //         }                                                                                                                         //
        //     };                                                                                                                            //
        //                                                                                                                                   //
        //     request.set("body", body);                                                                                                    //
        //     request.vaultSign = ic.get("vlt-sign");                                                                                       //
        //     request.vault = vault;                                                                                                        //
        //     request.signMessage(privateKey);                                                                                              //
        //     console.log("Sending topic join request");                                                                                    //
        //     let sendStart = new Date();                                                                                                   //
        //     this.vault.pendingInvites[inviteID] = {                                                                                       //
        //         nickname: nickname,                                                                                                       //
        //     }                                                                                                                             //
        //     self.messageQueue.enqueue(request);                                                                                           //
        //     now = new Date()                                                                                                              //
        //     console.log(`Request sent to island in  ${(now - sendStart) / 1000}sec. ${ (now - start) / 1000 } elapsed since beginning.`); //
        // }, 100)                                                                                                                           //
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    }


    getTopicName(pkfp){
        if(!this.topics.hasOwnProperty(pkfp)){
            throw new Error(`Topic ${pkfp} does not exist`)
        }
        return this.topics[pkfp].name
    }

    onSuccessfullSettingsUpdate(response, self){
        console.log("Settings successfully updated!");
        self.emit("settings_updated");
    }






    /**
     * New token on init topic received. Proceeding with topic creation
     * @param response
     * @param self
     */
    initTopicContinueAfterTokenReceived(self, response, pendingTopic){

        console.log("Token received, continuing creating topic");

        let token = response.body.token; // Token is 1-time disposable public key generated by server

        //Forming request
        let newTopicData = {
            topicKeyPair: pendingTopic.topicKeyPair,
            ownerPublicKey: pendingTopic.ownerKeyPair.publicKey,
        };

        let newTopicDataCipher = ChatUtility.encryptStandardMessage(JSON.stringify(newTopicData), token);

        //initializing topic settings
        let settings = Topic.prepareNewTopicSettings(self.version, pendingTopic.ownerNickName,
            pendingTopic.topicName,
            pendingTopic.ownerKeyPair.publicKey);

        let vaultRecord = self.vault.prepareVaultTopicRecord(this.version,
                                                             pendingTopic.ownerPkfp,
                                                             pendingTopic.ownerKeyPair.privateKey,
                                                             pendingTopic.topicName)

        //Preparing request
        let request = new Message(self.version);
        request.headers.command = Internal.INIT_TOPIC;
        request.headers.pkfpSource = pendingTopic.ownerPkfp;
        request.body.topicID = pendingTopic.topicID;
        request.body.settings = settings;
        request.body.ownerPublicKey = pendingTopic.ownerKeyPair.publicKey;
        request.body.newTopicData = newTopicDataCipher;
        request.body.vaultRecord = vaultRecord;
        request.body.vaultId = self.vault.id;


        self.arrivalHub.once(pendingTopic.ownerPkfp, (data)=>{
            switch(data.headers.message){
                case Events.INIT_TOPIC_SUCCESS:
                    self.initTopicSuccess(self, data, pendingTopic);
                    break;
                case Events.INIT_TOPIC_ERROR:
                    self.processInitTopicError(data, self);
                    console.error("Init topic error");
                    console.error(data.headers.error);
                    self.emit(Events.INIT_TOPIC_ERROR);
                    break;
                default:
                    console.error(`Invalid topic init response: ${data.headers.message}`)
            }
        })

        //Sending request

        self.messageQueue.enqueue(request);
    }

    initTopicSuccess(self, request, pendingTopic ){

        let pkfp = pendingTopic.ownerPkfp;
        let privateKey = pendingTopic.ownerKeyPair.privateKey;
        let nickname = pendingTopic.ownerNickName;
        let topicName = pendingTopic.topicName;

        let topic = self.vault.addTopic(pkfp, topicName, privateKey);
        topic.bootstrap(self.messageQueue, self.arrivalHub, self.version);
        topic.loadMetadata(data.body.metadata);
        self.vault.save(Internal.TOPIC_ADDED);

        // Add new topic to vault and save it


        self.emit("init_topic_success", {
            pkfp: pendingTopic.ownerPkfp,
            nickname: pendingTopic.ownerNickName,
            privateKey: pendingTopic.ownerKeyPair.privateKey
        });
        //delete self.newTopicPending[request.body.topicID];
    }

    renameTopic(topicPkfp, name){
        this.vault.renameTopic(topicPkfp, name);
    }






    //END//////////////////////////////////////////////////////////////////////

    // ---------------------------------------------------------------------------------------------------------------------------
    // Main API methods used by UI

    // Given topic pkfp request loaded messages
    getMessages(pkfp){
        console.log(`Get messages request on Chat`);
        let self = this
        if (!self.topics[pkfp])
            throw new Error(`Topic ${pkfp} not found!`)
        setTimeout(()=>{
            self.topics[pkfp].getMessages()
        }, 50)
    }

    async getMessagesAsync(pkfp){
        assert(this.topics[pkfp], `Topic ${pkfp} not found!`)
        return this.topics[pkfp].getMessagesAsync();
    }

    getParticipantNickname(topicPkfp, participantPkfp){

        if (!this.topics[topicPkfp]){
            throw new Error(`Topic ${topicPkfp} not found`)
        }
        return this.topics[topicPkfp].getParticipantNickname(participantPkfp);
    }

    getParticipantAlias(topicPkfp, participantPkfp){
        if (!this.topics[topicPkfp]){
            throw new Error(`Topic ${topicPkfp} not found`)
        }
        return this.topics[topicPkfp].getParticipantAlias(participantPkfp);
    }

    setParticipantAlias(topicPkfp, participantPkfp, newAlias){
        assert(this.topics[topicPkfp], `Topic ${topicPkfp}, not found`)
        this.topics[topicPkfp].setParticipantAlias(newAlias, participantPkfp)
    }

    changeNickname(topicPkfp, newNickname){
        assert(this.topics[topicPkfp], `Topic ${topicPkfp}, not found`)
        assert(newNickname && 3 < newNickname.length < 35, `New nickname length is invalid`)
        this.topics[topicPkfp].setParticipantNickname(newNickname, topicPkfp); //here topic is the same as particiapnt pkfp
    }

    setInviteAlias(topicPkfp, inviteCode, alias){
        assert(this.topics[topicPkfp], `Topic ${topicPkfp}, not found`)
        this.topics[topicPkfp].setInviteAlias(inviteCode, alias);
    }

    // Sends message
    sendMessage(msg, topicPkfp, recipient, files, onFilesUploaded){
        console.log(`Chat client send message called: ${msg} ${topicPkfp} ${recipient}`);
        let topic = this.topics[topicPkfp]

        if (!topic){
            throw new Error(`Topic ${topicPkfp} not found`)
        }
        let sendMessageAgent = new SendMessageAgent(topic, msg, recipient, files, onFilesUploaded)
        return sendMessageAgent.send();
    }

    downloadAttachment(fileInfo, topicPkfp){
        assert(this.topics[topicPkfp], "Topic is invalid");
        let topic = this.topics[topicPkfp];
        let downloadAttachmentAgent = new DownloadAttachmentAgent(fileInfo, topic);
        downloadAttachmentAgent.once(Events.DOWNLOAD_SUCCESS, (fileData, fileName)=>{
            console.log("Download successful event from agent");
            this.emit(Events.DOWNLOAD_SUCCESS, fileData, fileName);
        })
        downloadAttachmentAgent.once(Events.DOWNLOAD_FAIL, (err)=>{
            this.emit(Events.DOWNLOAD_FAIL, err);
        })


        downloadAttachmentAgent.download();
    }

    loadMoreMessages(topicPkfp){
        assert(this.topics[topicPkfp], "Topic is invalid");
        this.topics[topicPkfp].loadMoreMessages();
    }

    // ---------------------------------------------------------------------------------------------------------------------------
    // HELPERS
    //

    getParticipants(topicPkfp){
        if(this.topics.hasOwnProperty(topicPkfp)){
            return this.topics[topicPkfp].getParticipants();
        }
    }

    getTopics(){
        return this.topics;
    }

    getParticipantRepr(topicPkfp, participantPkfp){
        if (!this.topics[topicPkfp]){
            throw new Error(`Topic ${topicPkfp} not found`)
        }
        return this.topics[topicPkfp].getParticipantRepr(participantPkfp);
    }

    async _initMessageQueue(){
        this.messageQueue = new MessageQueue();
    }

    //requests vault and returns it
    getVault(){
        let url = "/";
        if (this.connectionString){
            url = this.connectionString;
        }
        return new Promise((resolve, reject)=>{
            XHR({
                type: "post",
                url: url,
                success: (data)=>{
                    console.log("Vault obtained. Processing...");
                    try{
                        resolve(data)
                    }catch(err){
                        reject(err);
                    }
                },
                error: err => {
                    reject(err);
                }
            })
        })
    }


}
