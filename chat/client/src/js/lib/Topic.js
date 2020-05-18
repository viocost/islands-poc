import { Events, Internal } from "../../../../common/Events";
import { WildEmitter } from "./WildEmitter";
import { Message } from "./Message";
import { Metadata } from  "./Metadata";
import { ChatUtility } from "./ChatUtility";
import { iCrypto } from  "./iCrypto";
import { ChatMessage } from "./ChatMessage";
import { ClientSettings } from "./ClientSettings";
import { CuteSet } from  "cute-set";
import { INSPECT_MAX_BYTES } from "buffer";
import { assert } from "../../../../common/IError";


const INITIAL_NUM_MESSAGES = 25

export class Topic{
    constructor(version, pkfp, name, key, comment){
        WildEmitter.mixin(this);
        this.pkfp = pkfp;
        this.name = name; // Topic alias. Not shared.
        this.privateKey = key;
        this.comment = comment;
        this.handlers = {};
        this.messageQueue;
        this.arrivalHub;
        this.currentMetadata;
        this.sharedKey;
        this.metadataId;
        this.lastPrivate;
        this.participants = {};
        this.messages = [];
        this.settings = {};
        this.invites = {};
        this.version  = version;
        this.getPrivateKey = ()=>{ return key }

        // Meaning event listeners are set for arrivalHub
        this.isBootstrapped = false;

        // Whether topic's metadata loaded
        this.metadataLoaded = false;

        // Initial messages load has been completed
        this.isInitLoaded = false;

        // All messages on this toipcs has been loaded
        this.allMessagesLoaded = false;

        // When topic has sent load n messages from the server and awaiting result
        this.awaitingMessages = false


    }

    static prepareNewTopicSettings(version, nickname, topicName, publicKey, encrypt = true){
        //Creating and encrypting topic settings:
        let settings = new ClientSettings(version);
        if(nickname){
            let ic = new iCrypto;
            ic.asym.setKey("pubk", publicKey, "public")
                .getPublicKeyFingerprint("pubk", "pkfp");
            settings.setOwnerNickname(ic.get("pkfp"), nickname);
        }

        if (encrypt){
            return ClientSettings.encrypt(publicKey, settings)
        }else {
            return settings;
        }
    }
    // ---------------------------------------------------------------------------------------------------------------------------
    // INITIALIZING
    bootstrap(messageQueue,
              arrivalHub,
              version){
        this.messageQueue = messageQueue;
        this.arrivalHub = arrivalHub;
        this.arrivalHub.on(this.pkfp, (msg)=>{
            this.preprocessIncomingMessage(msg, this);
        });
        this.version = version;
        this.setHandlers()

        this.isBootstrapped = true;
    }


    //Called when newly issued metadata arrived
    updateMetadata(metadata){
        if(typeof metadata === "string"){
            metadata = JSON.parse(metadata);
        }
        let settings = this._metadata.body.settings
        metadata.body.settings = settings;
        settings.membersData = ChatUtility.syncMap(Object.keys(metadata.body.participants),
                                                               settings.membersData,
                                                               {nickname: ""})
        this._metadata = metadata
        this.sharedKey = ChatUtility.privateKeyDecrypt(this.participants[this.pkfp].key, this.privateKey);
        this.metadataId = metadata.body.id;
        this.topicAuthority = metadata.body.topicAuthority;
        this.updateParticipants();
        this.saveClientSettings();
    }

    loadMetadata(metadata){
        let privateKey=this.privateKey;
        this._metadata = Metadata.fromBlob(metadata, privateKey);
        this.updateParticipants();
        this.sharedKey = this.getSharedKey()
        this.metadataId = this._metadata.getId();
        this.metadataLoaded = true;
    }
    //called only when loading metadata from Island on login
    loadMetadataBAK(metadata){
        if(typeof metadata === "string"){
            metadata = JSON.parse(metadata);
        }
        let settingsCipher = metadata.body.settings;
        let settings;
        if (!settingsCipher){
            settings = Topic.prepareNewTopicSettings(this.version, undefined, undefined, this.getPublicKey, false)
        } else{
            settings = JSON.parse(ChatUtility.decryptStandardMessage(settingsCipher, this.privateKey))
        }


        this._metadata = metadata
        this._metadata.body.settings = settings;
        this.settings = settings;
        this.updateParticipants()

        this.sharedKey = ChatUtility.privateKeyDecrypt(this.participants[this.pkfp].key, this.privateKey);
        this.metadataId = metadata.body.id;

        this.topicAuthority = metadata.body.topicAuthority;
        if (!metadata.body.settings.invites){
            metadata.body.settings.invites = {};
        }

        this.invites = metadata.body.settings.invites;
        this.metadataLoaded = true;
    }

    updateParticipants(){
        console.log("Updating participants");
        let metadata = this._metadata
        this.participants = {};
        for(let pkfp of Object.keys(metadata.body.participants)){
            this.participants[pkfp] = {};
            this.participants[pkfp].key = metadata.body.participants[pkfp].key;
            this.participants[pkfp].pkfp = metadata.body.participants[pkfp].pkfp;
            this.participants[pkfp].publicKey = metadata.body.participants[pkfp].publicKey;
            this.participants[pkfp].residence = metadata.body.participants[pkfp].residence;
            this.participants[pkfp].rights = metadata.body.participants[pkfp].rights;

            if(metadata.body.settings.membersData){
                this.participants[pkfp].nickname = metadata.body.settings.membersData[pkfp] ?
                    metadata.body.settings.membersData[pkfp].nickname : "";
                this.participants[pkfp].joined = metadata.body.settings.membersData[pkfp]?
                    metadata.body.settings.membersData[pkfp].joined : "";
            }
        }
    }

    /**
     * Loads topic's last n messsages
     * If wait for completion function will return only after load is completed
     */
    async initLoad(messagesToLoad=INITIAL_NUM_MESSAGES, waitCompletion=false){
        let self = this
        self.ensureBootstrapped(self);
        setTimeout(()=>{
            self._loadMessages(self, messagesToLoad)
            self.awaitingMessages = true;
        })
    }


    setHandlers(){
        let self = this;
        this.handlers[Internal.LOAD_MESSAGES_SUCCESS] = this.processMessagesLoaded
        this.handlers[Internal.INVITE_REQUEST_TIMEOUT] = ()=>{
            console.log("Invite request timeout");
        }

        this.handlers[Internal.INVITE_REQUEST_FAIL] = (msg)=>{
            console.log(`Invite request failed: ${msg.body.errorMsg}`);
        }
        this.handlers[Events.INVITE_CREATED] = (msg)=>{
            console.log("Invite created event");
            let newInvite = self.processInvitesUpdated(self, msg);
            self.emit(Events.INVITE_CREATED, newInvite);
        }

        this.handlers[Internal.DELETE_INVITE_SUCCESS] = (msg)=>{
            console.log("Invite deleted event");
            self.processInvitesUpdated(self, msg);
            self.emit(Internal.DELETE_INVITE_SUCCESS)
        }

        this.handlers[Internal.SETTINGS_UPDATED] = (msg)=>{
            console.log("Settings updated");
            self.processSettingsUpdated(self, msg);
        }

        this.handlers[Internal.METADATA_ISSUE] = (msg) =>{
            console.log(`Metadata issue received. Event: ${msg.headers.event}`)
            assert(Message.verifyMessage(self._metadata.getTAPublicKey(), msg), "TA signature is invalid")
            console.log("Signature verified. Loading metadata...");
            self._metadata.updateMetadata(msg.body.metadata);
            if(msg.body.invite && this._metadata.hasInvite(msg.body.invite)){
                //Invite was used by new member:
                this._metadata.deleteInvite(msg.body.invite);
            }
            if (msg.body.inviteePkfp){
                self.nicknameChangeNotify(msg.body.inviteePkfp)
            }
            self.saveClientSettings();
            console.log("Metadata updated");
            self.emit(Events.METADATA_UPDATED);
        }

        this.handlers[Internal.NICKNAME_INITAL_EXCHANGE] = (msg)=>{
            console.log("Initial nickname exchange request received. Processing");
            let senderPkfp = msg.headers.pkfpSource
            assert(self.participants[senderPkfp], "Member has not yet been registered")
            //assert(Message.verifyMessage(senderPublicKey, msg), "Signature is invalid")
            if(msg.body.metadataId === self._metadata.getId() && msg.body.myNickname){
                console.log("Decrypting new participant nickname...");
                let nickname = ChatUtility.symKeyDecrypt(msg.body.myNickname,
                                                         self.getSharedKey())
                console.log(`New member's nickname is ${nickname}`);
                console.log(`My current nickname is ${self.getCurrentNickname()}`);
                self.setParticipantNickname(nickname, senderPkfp);
            }

        }

        this.handlers[Internal.NICKNAME_NOTE] = (msg)=>{
            console.log(`nickname note received: metadataId: ${msg.body[Internal.METADATA_ID]}`);
            let senderPkfp = msg.headers.pkfpSource
            let senderPublicKey = self.participants[senderPkfp].publicKey;
            //assert(Message.verifyMessage(senderPublicKey, msg), "Signature is invalid")
            let sharedKey = ChatUtility.privateKeyDecrypt(msg.sharedKey, self.privateKey)
            let currentSharedKey = self.getSharedKey();
            console.log(`Current key: ${currentSharedKey}, received key ${sharedKey}`);
            let nickname = ChatUtility.symKeyDecrypt(msg.body.nickname, sharedKey)
            console.log(`Participan ${senderPkfp} changed his nickname to ${nickname}` );
            self.setParticipantNickname(nickname, senderPkfp)
        }

        this.handlers[Internal.SERVICE_RECORD] = (msg)=>{
            console.log("New service record arrved")
            let record = msg.body.serviceRecord;
            if (!record){
                console.error("Error: Service record is not found!");
                return;
            }

            record = new ChatMessage(record);
            record.decryptServiceRecord(self.privateKey);
            self.addNewMessage(self, record);
        }

        this.handlers[Internal.BROADCAST_MESSAGE] = (msg)=>{
            console.log("Broadcast message received");
            let msgCopy = JSON.parse(JSON.stringify(msg))
            // pkfpDest is added by server when message is broadcasted, so to verify it
            // must be deleted
            delete msgCopy.pkfpDest;
            assert(self.participants[msg.headers.pkfpSource], `The participant ${msgCopy.pkfpDest} not found`)

            let publicKey = self.participants[msg.headers.pkfpSource].publicKey;

            //assert(Message.verifyMessage(publicKey, msgCopy), "Message was not verified")
            let message = new ChatMessage(msg.body.message)
            message.decryptMessage(self.getSharedKey())
            self.addNewMessage(self, message);

            if(message.header.nickname !== self.getParticipantNickname(msg.headers.pkfpSource)){
                console.log(`Member's nickname has changed from ${self.getParticipantNickname(msg.headers.pkfpSource)} to ${message.header.nickname}`);
                self.setParticipantNickname(message.header.nickname, msg.headers.pkfpSource);
            }

        }

        this.handlers[Internal.SEND_MESSAGE] = (msg)=>{

            assert(self.participants[msg.headers.pkfpSource], `The participant ${msg.headers.pkfpDest} not found`)

            let publicKey = self.participants[msg.headers.pkfpSource].publicKey;
            assert(Message.verifyMessage(publicKey, msg))
            let message = new ChatMessage(msg.body.message)
            message.decryptPrivateMessage(self.privateKey);
            self.addNewMessage(self, message);
        }

        this.handlers[Internal.MESSAGE_SENT] = (msg)=>{
            console.log(`Message sent received. Message: ${msg.body.message}`);
            this.processMessageSent(this, msg)
        }

    }

    //End//////////////////////////////////////////////////////////////////////





    // ---------------------------------------------------------------------------------------------------------------------------
    // MESSAGE HANDLING

    processMessageSent(self, msg){
        let sentMessage = new ChatMessage(msg.body.message);
            console.log("Setting existing message from pending to delivered")
        let existingMessages = self.messages.filter((m)=>{
            return m.header.id === sentMessage.header.id;
        })
        assert(existingMessages.length < 2, `Message doubling error: ${existingMessages.length}`);
        let existingMessage = existingMessages[0];
        if (existingMessage){
            existingMessage.pending = false;
            self.emit(Internal.MESSAGE_SENT, existingMessage);
        } else {
            console.log("Decrypting and adding sent message.");
            sentMessage.header.private ?
                sentMessage.decryptPrivateMessage(self.privateKey) :
                sentMessage.decryptMessage(self.getSharedKey())
            self.addNewMessage(self, sentMessage);
        }
    }

    addNewMessage(self, chatMessage){
        console.log(`!!========ADDING NEW CHAT MESSAGE. msgCount: ${self.messages.length} \n${chatMessage.body}`);

        self.messages.splice(0, 0, chatMessage);
        console.log(`Message added. msgCount: ${self.messages.length}`);
        self.emit(Events.NEW_CHAT_MESSAGE, chatMessage, self.pkfp)
    }

    getMessages(messagesToLoad=INITIAL_NUM_MESSAGES, lastMessageId){
        if(this.initLoaded){
            this.emit(Events.MESSAGES_LOADED, this.messages)
        } else {
            console.log("Messages has not been loaded. Loading....");
            //init load and then emit
            this.initLoad()
        }
    }

    async getMessagesAsync(){
        if(this.initLoaded){
            return this.messages;
        } else {
            console.log("Messages has not been loaded. Loading....");
            //init load and then emit
            this.initLoad()
            return null;
        }
    }

    // Incoming message
    preprocessIncomingMessage(msg, self){
        console.log(`Incoming message on ${this.pkfp} received!`);

        if(self.handlers.hasOwnProperty(msg.headers.command)){
            self.handlers[msg.headers.command](msg, self)
        } else {
            let errMsg = `No handler found for command: ${msg.headers.command}`
            throw new Error(errMsg);
        }
    }

    getCurrentNickname(){
        if (!this.metadataLoaded){
            throw new Error("Cannot get current nickname: metadata is not loaded.")
        }

        return this._metadata.getParticipantNickname(this.pkfp);
    }

    getSharedKey(){
        return this._metadata.getSharedKey(this.pkfp, this.privateKey);
    }

    getParticipantPublicKey(pkfp){
        return this._metadata.getParticipantPublicKey(pkfp);
    }

    getMetadataId(){
        return this._metadata.getId();
    }

    loadMoreMessages(){
        if (this.awaitingMessages || this.allMessagesLoaded){
            console.log("Already awaiting messages")
            return;
        }
        console.log("Loading more messages");
        this.awaitingMessages = true;
        let lastMessageId = this.messages.length > 0 ?
            this.messages[this.messages.length-1].header.id : undefined;
        this._loadMessages(this, 25, lastMessageId);
    }

    _loadMessages(self, quantity=25, lastMessageId){
        let request = new Message(self.version);
        request.headers.command = Internal.LOAD_MESSAGES;
        request.headers.pkfpSource = self.pkfp;

        request.body.quantity = quantity;
        if (lastMessageId){
            request.body.lastMessageId = lastMessageId;
        }
        request.addNonce();
        request.signMessage(self.privateKey);
        self.messageQueue.enqueue(request)
    }


    // ---------------------------------------------------------------------------------------------------------------------------
    // INVITES HANDLING
    requestInvite(){
        let self = this;
        if(!self.metadataLoaded){
            throw new Error("Metadata has not been loaded yet.")
        }
        setTimeout(()=>{
            let request = new Message(self.version);
            let taPublicKey = self._metadata.getTAPublicKey();
            let myNickNameEncrypted = ChatUtility.encryptStandardMessage(self.participants[self.pkfp].nickname,
                taPublicKey);
            let topicNameEncrypted = ChatUtility.encryptStandardMessage(self.name, taPublicKey);
            request.setCommand(Internal.REQUEST_INVITE);
            request.setSource(self.pkfp);
            request.setDest(self._metadata.getTAPkfp());
            request.body.nickname = myNickNameEncrypted;
            request.body.topicName = topicNameEncrypted;
            request.signMessage(self.privateKey);
            self.messageQueue.enqueue(request);
        }, 100)

    }

    setInviteAlias(code, alias){
        this._metadata.setInviteAlias(code, alias)
        this.saveClientSettings();
    }

    getInvites(){
        return this._metadata.getInvites();
    }

    syncInvites(){
        let request = new Message(self.version);
        request.headers.command = "sync_invites";
        request.headers.pkfpSource = this.session.publicKeyFingerprint;
        request.headers.pkfpDest = this.session.metadata.topicAuthority.pkfp;
        request.headers.nonce = ic.get("nhex");
        request.signMessage(this.session.privateKey);
        this.chatSocket.emit("request", request);
    }


    deleteInvite(inviteCode){
        console.log("About to delete invite: " + inviteCode);
        assert(this._metadata.hasInvite(inviteCode), `Invite does not exists: ${inviteCode}`)
        let request = new Message(this.version);
        request.headers.command = Internal.DELETE_INVITE;
        request.headers.pkfpSource = this.pkfp;
        request.headers.pkfpDest = this._metadata.getTAPkfp();
        let body = {
            invite: inviteCode,
        };
        request.set("body", body);
        request.signMessage(this.privateKey);
        this.messageQueue.enqueue(request);
    }

    updatePendingInvites(userInvites){
        for(let i of userInvites){
            if(!this.session.settings.invites.hasOwnProperty(i)){
                this.session.settings.invites[i] = {}
            }
        }
        for (let i of Object.keys(this.session.settings.invites)){
            if(!userInvites.includes(i)){
                delete this.session.settings.invites[i];
            }
        }

        this.saveClientSettings();
    }
    //END//////////////////////////////////////////////////////////////////////

    // ---------------------------------------------------------------------------------------------------------------------------
    // Nickname handling
    //TODO
    exchangeNicknames(){
        console.log(`Attempting to exchange nicknames. Sending my nickname: ${this.getCurrentNickname()}`);
        if(!this.isBootstrapped){
            console.log("Cannot exchange nicknames: topic not bootstrapped.");
            return;
        }
        let myNicknameRaw = this.getCurrentNickname();
        let myNickname = ChatUtility.symKeyEncrypt(myNicknameRaw,  this.sharedKey);
        let request = Message.createRequest(this.version,
                                            this.pkfp,
                                            Internal.NICKNAME_INITAL_EXCHANGE)
        request.body.metadataId = this.metadataId;
        request.body.myNickname = myNickname;
        request.signMessage(this.privateKey);
        this.messageQueue.enqueue(request);
        console.log(`Nicknames exchange request sent: nickname: ${myNicknameRaw}`);
    }

    getMetadata(){
        return this._metadata;
    }

    hasParticipant(pkfp){
        return this._metadata.hasParticipant(pkfp);
    }

    getParticipantNickname(pkfp){
        if (this._metadata.body.settings.membersData[pkfp]){
            return this._metadata.body.settings.membersData[pkfp].nickname
        }
    }

    setParticipantNickname(nickname, pkfp){

        this._metadata.setParticipantNickname(nickname, pkfp);
        this.saveClientSettings();
        if (pkfp === this.pkfp){
            this.nicknameChangeNotify()
        }

    }

    setParticipantAlias(alias, pkfp){
        this._metadata.setParticipantAlias(alias, pkfp)
        this.saveClientSettings();
    }

    nicknameChangeNotify(pkfp){
        let self = this;
        let curNickname = self.getCurrentNickname()
        let sharedKey = self.getSharedKey()
        console.log(`Sending current nickname: ${curNickname}. Encrypting with: ${sharedKey}`);
        let message = new Message(self.version);
        message.setCommand(Internal.NICKNAME_NOTE)
        message.setSource(self.pkfp);
        if(pkfp){
            message.setDest(pkfp);
        }
        message.addNonce();
        message.setAttribute("nickname",
                            ChatUtility.symKeyEncrypt(curNickname, sharedKey));
        message.setAttribute(Internal.METADATA_ID, self._metadata.getId());
        message.signMessage(self.privateKey);
        self.messageQueue.enqueue(message);
    }

    requestNickname(pkfp){
        if(!pkfp){
            throw new Error("Missing required parameter");
        }
        let request = new Message(self.version);
        request.setCommand("whats_your_name");
        request.setSource(this.session.publicKeyFingerprint);
        request.setDest(pkfp);
        request.addNonce();
        request.signMessage(this.session.privateKey);
        this.chatSocket.emit("request", request);
    }

    broadcastNameChange(){
        let self = this;
        let message = new Message(self.version);
        message.setCommand("nickname_change_broadcast");
        message.setSource(this.session.publicKeyFingerprint);
        message.addNonce();
        message.body.nickname = ChatUtility.symKeyEncrypt(self.session.settings.nickname, self.session.metadata.sharedKey);
        message.signMessage(this.session.privateKey);
        this.chatSocket.emit("request", message);
    }

    processNicknameResponse(request, self){
        self._processNicknameResponseHelper(request, self)
    }

    processNicknameChangeNote(request, self){
        self._processNicknameResponseHelper(request, self, true)
    }

    _processNicknameResponseHelper(request, self, broadcast = false){
        console.log("Got nickname response");
        let publicKey = self.session.metadata.participants[request.headers.pkfpSource].publicKey;
        if(!Message.verifyMessage(publicKey, request)){
            console.trace("Invalid signature");
            return
        }
        let existingNickname = self.getMemberNicknamr(request.headers.pkfpSource);
        let memberRepr = self.getMemberRepr(request.headers.pkfpSource);
        let newNickname = broadcast ? ChatUtility.symKeyDecrypt(request.body.nickname, self.session.metadata.sharedKey) :
            ChatUtility.decryptStandardMessage(request.body.nickname, self.session.privateKey);
        newNickname = newNickname.toString("utf8");

        if( newNickname !== existingNickname){
            self.setParticipantNickname(newNickname, request.headers.pkfpSource);
            self.saveClientSettings();
            if(existingNickname && existingNickname !== ""){
                self.createServiceRecordOnMemberNicknameChange(memberRepr, newNickname, request.headers.pkfpSource);
            }
        }
    }

    //~END NICKNAME HANDLING///////////////////////////////////////////////////

    // ---------------------------------------------------------------------------------------------------------------------------
    // Settings handling

    saveClientSettings(){
        let body = this._metadata.getSettingsEncrypted(this.privateKey)
        let request = new Message(this.version);
        request.setSource(this.pkfp);
        request.setCommand(Internal.UPDATE_SETTINGS)
        request.set("body", body);
        request.signMessage(this.privateKey);
        console.log("Sending update settings request");
        this.messageQueue.enqueue(request);
    }

    //~END SETTINGS ///////////////////////////////////////////////////////////


    createRegisterServiceRecord(event, message){
        let request = new Message(self.version);
        request.addNonce();
        request.setSource(this.session.publicKeyFingerprint);
        request.setCommand(Internal.REGISTER_SERVICE_RECORD);
        request.body.event = event;
        request.body.message = ChatUtility.encryptStandardMessage(message,
            this.getPublicKey);
        request.signMessage(this.privateKey);
        this.messageQueue.enqueue(request)
    }

    processMessagesLoaded(msg, self){
        let data = msg.body.lastMessages;
        let keys = data.keys;

        console.log(`Messages loaded. Processing.... Keys: ${keys}`);
        let metaIDs = Object.keys(keys);
        for (let i=0;i<metaIDs.length; ++i){
            let ic = new iCrypto;
            ic.addBlob('k', keys[metaIDs[i]])
                .hexToBytes("k", "kraw")
                .setRSAKey("priv", self.privateKey, "private")
                .privateKeyDecrypt("kraw", "priv", "kdec");
            keys[metaIDs[i]] = ic.get("kdec");
        }

        let messages = data.messages;
        let result = [];
        for (let i=0; i<messages.length; ++i){
            let message = new ChatMessage(messages[i]);
            if(message.header.service){
                message.body = ChatUtility.decryptStandardMessage(message.body, self.privateKey)
            } else if(message.header.private){
                message.decryptPrivateMessage(self.privateKey);
            } else{
                if(!keys.hasOwnProperty(message.header.metadataID)){
                    console.error(`Warning! key not found for ${message.headers.metadataID}`)
                }
                message.decryptMessage(keys[message.header.metadataID]);
            }
            result.push(message);
        }

        if(!self.initLoaded || self.messages.length === 0){
            self.messages = result;
        } else {
            let latestLoadedID = result[0].header.id;
            let glueIndex = self.messages.findIndex((msg)=>{
                return msg.header.id === latestLoadedID;
            });
            self.messages = glueIndex ? [...self.messages.slice(0, glueIndex), ...result] :
                [...self.messages, ...result]

        }
        self.initLoaded = true;
        self.allMessagesLoaded = data.allLoaded;
        self.awaitingMessages = false;
        self.emit(Events.MESSAGES_LOADED, self.messages);
    }


    processSettingsUpdated(self, msg){
        let settings = msg.body.settings;
        let signature = msg.body.signature;
        let metadata = Metadata.fromBlob(msg.body.metadata, self.privateKey);

        let ic = new iCrypto()
        ic.addBlob("settings", settings)
          .addBlob("sign", signature)
          .setRSAKey("pub", self.getPublicKey(), "public")
          .publicKeyVerify("settings", "sign", "pub", "res")
        if(!ic.get("res")) throw new Error("Settings blob signature verification failed")

        let settingsPlain = JSON.parse(ChatUtility.decryptStandardMessage(settings, self.privateKey))
        if(this._metadata.getId() !== metadata.getId()){
            console.log("Metadata has been updated. Updating...");
            this._metadata.updateMetadata(metadata)
        }


        self._metadata.updateSettings(settingsPlain);
        self.updateParticipants();
        console.log("Settings updated successfully!");
        self.emit(Events.SETTINGS_UPDATED);
    }

    //Notification on alias change. Disable for now
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // detectAliasNicknameChangesOnSettingsUpdate(settingsPlain){                                                  //
    //     Object.keys(this._metadata.body.settings.membersData).forEach(k=>{                                      //
    //                                                                                                             //
    //         if(this._metadata.body.settings.membersData[k].nickname !== settingsPlain.membersData[k].nickname){ //
    //             this.emit(Events.NICKNAME_CHANGED, {                                                            //
    //                 topicPkfp: this.pkfp,                                                                       //
    //                 oldNickname: this._metadata.body.settings.membersData[k].nickname,                          //
    //                 newNickname: settingsPlain.membersData[k].nickname,                                         //
    //                 participantPkfp: k                                                                          //
    //             })                                                                                              //
    //         }                                                                                                   //
    //                                                                                                             //
    //         if(this._metadata.body.settings.membersData[k].alias !== settingsPlain.membersData[k].alias){       //
    //             this.emit(Events.PARTICIPANT_ALIAS_CHANGED, {                                                   //
    //                 topicPkfp: this.pkfp,                                                                       //
    //                 oldAlias: this._metadata.body.settings.membersData[k].alias,                                //
    //                 newAlias: settingsPlain.membersData[k].alias,                                               //
    //                 participantPkfp: k                                                                          //
    //             })                                                                                              //
    //         }                                                                                                   //
    //     })                                                                                                      //
    //                                                                                                             //
    //     Object.keys(this._metadata.body.settings.invites).forEach(k=>{                                          //
    //         if (this._metadata.body.settings.invites[k].name !== settingsPlain.invites[k].name){                //
    //             this.emit(Events.INVITE_ALIAS_CHANGED, {                                                        //
    //                 topicPkfp: this.pkfp,                                                                       //
    //                 oldAlias: this._metadata.body.settings.invites[k].name,                                     //
    //                 newAlias: settingsPlain.invites[k].name,                                                    //
    //                 invite: k                                                                                   //
    //             })                                                                                              //
    //         }                                                                                                   //
    //     })                                                                                                      //
    // }                                                                                                           //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    //TODO Cleanup or implememnt

    processInvitesUpdated(self, msg){
        assert(Message.verifyMessage(self._metadata.getTAPublicKey(), msg), "TA signature is invalid")
        let data = JSON.parse(ChatUtility.decryptStandardMessage(msg.body.data, self.privateKey))

        console.log(`Invites data has been decrypted successfully.`);
        if (data.inviteCode){
            console.log(`New invite: ${data.inviteCode}`);
        }

        self._metadata.updateInvites(data.userInvites);
        self.saveClientSettings();
        return data.inviteCode;
    }

    getParticipantAlias(pkfp){
        if(!this.isBootstrapped || !pkfp){
            return
        }
        return this._metadata.getParticipantAlias(pkfp)
    }

    getParticipants(){
        let res = JSON.parse(JSON.stringify(this._metadata.body.participants))
        Object.keys(res).forEach(k =>{
            res[k].alias = this._metadata.getParticipantAlias(k)
            res[k].nickname = this._metadata.getParticipantNickname(k)
        })
        return res;
    }

    getParticipantRepr(pkfp){
        if (this.participants[pkfp]){
            return this.participants[pkfp].alias || this.participants[pkfp].nickname  || "Unknown";
        }
    }



    getPublicKey(){
        if(!this.privateKey) throw new Error("No private key found")
        if(!this.publicKey){
            let ic = new iCrypto()
            ic.setRSAKey("priv", this.privateKey, "private")
                .publicFromPrivate("priv", "pub")
            this.publicKey = ic.get("pub")
        }
        return this.publicKey;
    }

    ensureInitLoaded(){
        if(!this.initLoaded || !this.currentMetadata){
            throw new Error("Topic has no metadata");
        }
    }

    ensureBootstrapped(self){
        if(!self.isBootstrapped || !self.messageQueue || !self.arrivalHub){
            throw new Error("Topic is not bootstrapped!");
        }
    }

    setName(name){
        this.name = name;
    }

    setPrivate(pkfp){
        assert(this.hasParticipant(pkfp), `Set private error: no member found ${pkfp}`)
        this.lastPrivate = pkfp;
    }

    getPrivate(pkfp){
        return this.lastPrivate;
    }

    resetPrivate(){
        this.lastPrivate = null
    }

    //Verifies current metadata
    verifyMetadata(){
        return Metadata.isMetadataValid(this._metadata)
    }

    setTopicName(name){
        assert(2<=name.length<=30, `Topic name is invalid`)
        this.name = name;
    }
}
