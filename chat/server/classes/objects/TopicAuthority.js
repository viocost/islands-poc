const iCrypto = require("../libs/iCrypto.js");
const Err = require("../libs/IError.js");
const assert = require("../libs/assert.js");
const Metadata = require("./Metadata.js");
const Message = require("./Message.js");
const EventEmitter = require("events").EventEmitter;
const MiddlewareManager = require("js-middleware").MiddlewareManager;
const Util = require("../libs/ChatUtility.js");
const Request = require("./ClientRequest.js");
const Response = require("../objects/ClientResponse.js");
const ServiceMessage = require("../objects/ServiceMessage.js");
const Invite = require("./Invite.js");
const CuteSet = require("cute-set");
const MetadataIssue = require("../enums/MetadataIssueMessages.js");
const Logger = require("../libs/Logger.js");
const { Internal, Events } = require("../../../common/Events.js");
const objUtil = require("../../../common/ObjectUtil");


class TopicAuthority extends EventEmitter{

    /**
     *
     * @param historyManager
     */
    constructor(historyManager){
        super();
        this.hm = historyManager;
        this.middlewareManager = new MiddlewareManager(this);
        this.inviteIndex = {};

        //this.enableMiddlewareCheckers()
    }

    enableMiddlewareCheckers(){
        this.middlewareManager.use("signMetadata", this.verifyIsOperational);
        this.middlewareManager.use("signSharedKey", this.verifyIsOperational);
        this.middlewareManager.use("reKeyMetadata", this.verifyIsOperational);
    }

    /****************************************
     * Request handling
     ****************************************/
    /**
     * Processes invite request and returns formed response
     */
    async processInviteRequest(request){
        const participant = this.currentMetadata.body.participants[request.headers.pkfpSource];
        const pubKey = participant.publicKey

        assert(Message.verify(request, pubKey), "Invite request signature is invalid");

        const newInviteCode = await this.createNewInvite(participant.pkfp, request.body.nickname, request.body.topicName);
        Logger.debug("Topic authority created new invite ", {
            cat: "invite",
            inviter: participant.pkfp,
            inviteCode: newInviteCode
        })
        const userInvites = await this.getUserInvites(participant.pkfp);
        let response = Message.makeResponse(request, this.pkfp, Events.INVITE_CREATED);
        let rawData = JSON.stringify({
            inviteCode: newInviteCode,
            userInvites: userInvites
        })
        let cipher = Util.encryptStandardMessage(rawData, pubKey);
        response.setAttribute("data", cipher);
        this.signMessage(response);
        return response;
    }

    async processDelInviteRequest(request){
        const participant = this.currentMetadata.body.participants[request.headers.pkfpSource];
        const pubKey = participant.publicKey
        if (!Request.isRequestValid(request, pubKey)){
            throw new Error("Request is invalid!");
        }

        console.log("Deleting invite!");
        let invite = Invite.parse(request.body.invite);
        await this.hm.taDelInvite(invite.getInviteCode(), request.headers.pkfpSource);
        if(this.inviteIndex[request.headers.pkfpSource]){
            let curInvites = new CuteSet(this.inviteIndex[request.headers.pkfpSource]);
            curInvites.delete(invite.getInviteCode());
            this.inviteIndex[request.headers.pkfpSource] = curInvites.toArray();
        }
        await this.saveInviteIndex();
        let remainingInvites =  await this.getUserInvites(request.headers.pkfpSource);
        Logger.debug(`DELETE invite success. taPkfp: ${this.pkfp}`, {cat: "invite"});
        let response = Message.makeResponse(request, this.pkfp, Internal.DELETE_INVITE_SUCCESS)

        let rawData = JSON.stringify({
            userInvites: remainingInvites
        })
        let cipher = Util.encryptStandardMessage(rawData, pubKey);
        response.setAttribute("data", cipher);
        this.signMessage(response);
        return response;
    }


    async createNewInvite(requesterPkfp, requesterNicknameEncrypted, topicName){
        const invite = new Invite(this.getResidence(), this.getPkfp());
        const inviteString = invite.toString();
        const sign = this.signBlob(inviteString);
        await this.saveInvite(this.prepareInviteForPresistence(inviteString, sign, requesterPkfp, requesterNicknameEncrypted, topicName)
            , invite.getInviteCode());
        await this.addInviteToIndex(invite.getInviteCode(), requesterPkfp)
        return inviteString;
    }

    async addInviteToIndex(inviteId, pkfp){
        if(!this.inviteIndex[pkfp]){
            this.inviteIndex[pkfp] = [inviteId]
        }else{
            this.inviteIndex[pkfp].push(inviteId)
        }

        await this.saveInviteIndex()
    }

    async saveInviteIndex(){
        let newInviteIndex = Util.encryptStandardMessage(JSON.stringify(this.inviteIndex), this.publicKey);
        await this.hm.taSaveInviteIndex(this.getPkfp(), newInviteIndex);
    }

    async loadInviteIndex(){
        let privateKey = this.getTAPrivateKey();
        let inviteIndexCipher = await this.hm.taLoadInviteIndex(this.getPkfp());
        if(inviteIndexCipher){
            this.inviteIndex = JSON.parse(Util.decryptStandardMessage(inviteIndexCipher, privateKey))
        } else{
            this.inviteIndex = {};
        }

    }

    async saveInvite(invite = Err.required(),
               inviteId = Err.required()){
        const encryptedInviteBlob = Util.encryptStandardMessage(invite, this.getPublicKey());
        await this.hm.saveNewInvite(encryptedInviteBlob, inviteId, this.getPkfp())
    }


    prepareInviteForPresistence(invite = Err.required(),
                                signature = Err.required(),
                                requesterPkfp = Err.required(),
                                requesterNickname,
                                topicName){
        return JSON.stringify({
            invite: invite,
            signature: signature,
            requesterPkfp: requesterPkfp,
            requesterNickname: requesterNickname,
            topicName: topicName
        })
    }


    async getUserInvites(pkfp){
        if(!this.inviteIndex[pkfp] || this.inviteIndex[pkfp].length === 0){
            return [];
        }
        let promises = [];
        let invites = [];

        for (let i of this.inviteIndex[pkfp]){
            promises.push(this.hm.taGetInvite(i, this.getPkfp()))
        }
        let invitesEncrypted = await Promise.all(promises);

        let privateKey = this.getTAPrivateKey();
        for (let i of invitesEncrypted){
            invites.push(JSON.parse(Util.decryptStandardMessage(i, privateKey)).invite);
        }

        this.reEncryptPrivateKey(privateKey);
        return invites;
    }

    async joinByInvite(inviteString, inviteeInfo, newMemeberResidence){
        console.log("\n\nCurrent metadata at beginning of joinByInvite:"+ this.getCurrentMetadata().toBlob())
        let invite = await this.getInvite(inviteString);
        await this.verifyInvite(invite);
        let privateKey = this.getTAPrivateKey();
        let inviterNickname = Util.encryptStandardMessage(Util.decryptStandardMessage(invite.requesterNickname, privateKey), inviteeInfo.publicKey);
        let topicName = Util.encryptStandardMessage(Util.decryptStandardMessage(invite.topicName, privateKey), inviteeInfo.publicKey);

        const currentMemebers = [];
        for (let key of Object.keys(this.getCurrentMetadata().body.participants)){
            currentMemebers.push(key);
        }
        await this.processJoinByInvite(inviteeInfo.publicKey, newMemeberResidence);
        this.issueMetadata({
            recipients: currentMemebers,
            invite: inviteString,
            event: MetadataIssue.events.newMemberJoin,
            pkfp: inviteeInfo.pkfp
        });
        await this.consumeInvite(inviteString, invite.requesterPkfp);

        Logger.debug("Topic join: ", {
            cat: "topic_join"
        })

        return {
            metadata: this.getCurrentMetadata().toBlob(),
            inviterNickname: inviterNickname,
            topicName: topicName,
            inviterPkfp: invite.requesterPkfp
        }
    }


    async processJoinByInvite(newMemberPublicKey = Err.required(),
                        newMemeberResidence = Err.required()) {
        const newParticipant = Metadata.createNewParticiapnt(newMemberPublicKey, newMemeberResidence);
        const metadata = this.getCurrentMetadata();
        console.log("Metadata before join: " + metadata.toBlob())
        metadata.addParticipant(newParticipant);
        let newMetadata = this.reKeyMetadata(metadata);
        this.signMetadata(metadata);
        console.log("Metadata after join: " + newMetadata.toBlob())
        this.setMetadata(newMetadata);
        await this.appendCurrentMetadata()
    }

    async processInvitesSyncRequest(request) {
        const participant = this.currentMetadata.body.participants[request.headers.pkfpSource];
        if (!Request.isRequestValid(request, participant.publicKey)){
            throw new Error("Request is invalid!");
        }
        let invites = await this.getUserInvites(request.headers.pkfpSource);
        let response = new Response("sync_invites_success", request);
        response.setAttribute("invites", invites);
        this.signResponse(response);
        return response;
    }




    async consumeInvite(inviteString = Err.required(), pkfp){
        console.log("consuming invite");
        const invite = Invite.parse(inviteString);
        await this.hm.consumeInvite(invite.getPkfp(), invite.getInviteCode());
        this.inviteIndex[pkfp] = (new CuteSet(this.inviteIndex[pkfp]).difference([invite.getInviteCode()])).toArray();
        await this.saveInviteIndex();
    }

    async getInvite(inviteString = Err.required()){
        const passedInvite = Invite.parse(inviteString);
        const inviteCipher = await this.hm.taGetInvite(passedInvite.getInviteCode(), this.getPkfp());
        let privateKey = this.getTAPrivateKey();
        let invite =  JSON.parse(Util.decryptStandardMessage(inviteCipher, privateKey));
        this.reEncryptPrivateKey(privateKey);
        return invite;
    }

    async verifyInvite(invite = Err.required()){
        if(!this.verifyBlob(invite.invite, invite.signature)){
            throw new Error("Invite is invalid");
        }
    }

    async processTopicLeave(pkfp){
        await this._excludeParticipant(pkfp);

        let remainingParticipants = new CuteSet(Object.keys(lastMeta.body.participants)).minus(pkfp).toArray();
        this.issueMetadata({
            event: Events.PARTICIPANT_LEFT,
            recipients: remainingParticipants,
            participantLeft: pkfp
        })
    }

    async processBootRequest(request){
        let requestorPkfp = request.headers.pkfpSource;
        let lastMeta = this.getCurrentMetadata();
        let bootCandidate = lastMeta.body.participants[request.body.pkfp];
        let remainingParticipants = new CuteSet(Object.keys(lastMeta.body.participants)).minus(request.body.pkfp).toArray();

        if (lastMeta.body.participants[requestorPkfp].rights < 3){
            //Todo log suspicious request
            throw new Error("requester has not enough rights to boot");
        }
        await this._excludeParticipant(bootCandidate.pkfp);
        let noticeToBooted = new ServiceMessage(this.getPkfp(), bootCandidate.pkfp, "u_booted");
        this.emit("send_notice", {notice: noticeToBooted, residence: bootCandidate.residence});
        //issue metadata
        this.issueMetadata({
            event: MetadataIssue.events.memberBoot,
            recipients: remainingParticipants,
            bootedPkfp: bootCandidate.pkfp
        })
    }

    async _excludeParticipant(pkfp){
        let lastMeta = this.getCurrentMetadata();
        lastMeta.removeParticipant(pkfp);
        let newMetadata = this.reKeyMetadata(lastMeta);
        this.signMetadata(newMetadata);
        this.setMetadata(newMetadata);
        await this.appendCurrentMetadata();
    }



    async metadataSyncRequest(request){
        Logger.debug("Topic authority: processing metadata sync request", {
            pkfp: request.headers.pkfpSource
        })
        let self = this;
        let curMembers = new CuteSet(Object.keys(this.getCurrentMetadata().body.participants));
        if(!curMembers.has(request.headers.pkfpSource)){
            console.log("Resync request from non-existing member");
            return;
        }

        let lastMetadataRecords = await self.hm.getLastMetadataRecords(request.body.lastMetaID, request.headers.pkfpDest);
        console.log("Records obtained!");
        let response = new Response("meta_sync_success", request);
        response.headers.event = MetadataIssue.events.metadataSync;
        response.body.metadata = JSON.stringify(lastMetadataRecords);
        self.signResponse(response);
        return response;
    }
    /****************************************
     * ~END Request handling~
     ****************************************/




    /****************************************
     * Helpers
     ****************************************/

    async initialize(clientPublicKey, clientResidence, taPrivateKey, taResidence) {

        //Setting keys and residence
        this.setResidence(taResidence)
        this.encryptCachePrivateKey(taPrivateKey);
        this.setKeysFromPrivate(taPrivateKey);

        //Creating new participant
        const sharedKey = this.getNewSymKey();
        const participant = Metadata.createNewParticiapnt(clientPublicKey, clientResidence, 3);
        participant.set("key", Util.publicKeyEncrypt(sharedKey, clientPublicKey));

        //Creating new metadata
        const metadataBlank = Metadata.createNewMetadata();

        //Adding participant as owner and registering self as topic authority
        Metadata.addParticipant(metadataBlank, participant);
        Metadata.setOwner(metadataBlank, participant);
        Metadata.setTopicAuthority(metadataBlank, this);

        //refreshing shared key
        const metadata = this.reKeyMetadata(metadataBlank);

        //signing metadata
        this.signMetadata(metadata);

        //setting as current metadata
        this.setMetadata(metadata);

        //persisting
        await this.hm.initTopicAuthority(this.getPkfp());
        await this.hm.taSavePrivateKey(this.getPkfp(), Util.encryptStandardMessage(this.getTAPrivateKey(), clientPublicKey));
        await this.hm.taAppendMetadata(this.getPkfp(), this.getCurrentMetadata().toBlob());

    }



    getNewSymKey(){
        const ic = new iCrypto();
        ic.sym.createKey("key");
        return ic.get("key");
    }



    signBlob(blob = Err.required()){
        const ic = new iCrypto();
        let privKey = this.getTAPrivateKey();
        ic.asym.setKey("privk", privKey, "private")
            .addBlob("blob", blob)
            .asym.sign("blob", "privk", "sign");
        this.reEncryptPrivateKey(privKey);
        return ic.get("sign");
    }

    verifyBlob(blob = Err.required(), signature = Err.required()){
        const ic = new iCrypto();
        ic.asym.setKey("pub", this.getPublicKey(), "public")
            .addBlob("blob", blob)
            .addBlob("sign", signature)
            .publicKeyVerify("blob", "sign", "pub", "res");
        return ic.get("res");
    }


    signSharedKey(sharedKey){
        //TODO middleware check if private key is set
        const privateKey = this.getTAPrivateKey();
        const ic = new iCrypto();
        ic.addBlob("sym", sharedKey)
            .asym.setKey("privk", privateKey, "private")
            .asym.sign("sym", "privk", "sign");
        this.reEncryptPrivateKey(privateKey);
        return ic.get("sign");
    }

    //TODO
    async appendCurrentMetadata(){
        let metadataBlob = this.getCurrentMetadata().toBlob()
        console.log(`\n\nAppending current metadata: ${metadataBlob}\n\n`)
        await this.hm.taAppendMetadata(this.getPkfp(), metadataBlob);
    }




    issueMetadata(data = {}){
        data.metadata = this.getCurrentMetadata();
        this.emit(Internal.METADATA_ISSUE, data)
    }

    verifyIsOperational(){
        if(this.taPrivateKey !== undefined)
            throw new Error("Private key is not set");
    }



    signRequestOnMetadataIssue(message){
        return this.signMessage(message)
    }

    signResponse(response){
        return this.signMessage(response)
    }

    signNotice(notice){
        return this.signMessage(notice)
    }

    signMessage(message){
        let privKey = this.getTAPrivateKey();
        let signed = Response.signResponse(message, privKey);
        this.reEncryptPrivateKey(privKey);
        return signed;
    }



    /****************************************
     * ~END helpers
     ****************************************/
    setKeysFromPrivate(topicPrivateKey){
        let ic = new iCrypto();
        ic.asym.setKey("pkraw", topicPrivateKey, "private")
            .publicFromPrivate("pkraw", "pubk")
            .getPublicKeyFingerprint("pubk", "pkfp");
        this.setPkfp(ic.get("pkfp"));
        this.setPublicKey(ic.get("pubk"))
    }

    encryptCachePrivateKey(privateKey){
        this.reEncryptPrivateKey(privateKey);
    }

    /**
     * Signs prepared metadata, specifically just body part
     * and saves signature in metadata.signature
     * @param metadata
     */
    signMetadata(metadata = Err.required("TopicAuthority signMetadata: missing required parameter: 'metadata'")){
        let ic = new iCrypto();
        ic.addBlob("body", JSON.stringify(metadata.body))
            .asym.setKey("privk", this.getTAPrivateKey(), "private")
            .privateKeySign("body", "privk", "sign");
        metadata.signature = ic.get("sign");
        this.reEncryptPrivateKey(ic.get("privk"))
    }

    /**
     * Given instance of Metadata issues new shared key,
     * signs it, saves within metadata.
     *
     * returns updated metadata
     *
     */
    reKeyMetadata(metadata = Err.required("TopicAuthority reKeyMetadata: missing required parameter: 'metadata'")){
        if (!Metadata.isMetadataInstance(metadata)){
            throw new Error("metadata must be an instance of Metadata class");
        }

        const newSharedKey = this.getNewSymKey();
        const sharedKeySign = this.signSharedKey(newSharedKey);

        for (let pkfp of Object.keys(metadata.body.participants)){
            const pubKey = metadata.body.participants[pkfp].publicKey;
            metadata.body.participants[pkfp].key = Util.publicKeyEncrypt(newSharedKey, pubKey);
        }

        metadata.setSharedKeySignature(sharedKeySign);
        metadata.refreshId();
        return metadata;
    }

    /**
     * Uses current token to decrypt previously encrypted private key
     */
    getTAPrivateKey(){
        let token = this.getToken();
        let ic = new iCrypto();
        ic.addBlob("pkcip", this.taPrivateKey)
            .sym.setKey("sym", token)
            .sym.decrypt("pkcip", "sym", "pk", true);
        const res = ic.get("pk");
        this.reEncryptPrivateKey(res);
        return res;
    }

    /**
     * Refreshes the token, Takes __RAW__ private key,  and encrypts it with new token
     * @param privateKey
     */
    reEncryptPrivateKey(privateKey = Err.required("TopicAuthority reEncryptPrivateKey: missing required parameter: 'privateKey'")){
        this.refreshToken();
        let ic = new iCrypto();
        ic.addBlob("pk", privateKey)
            .sym.setKey("sym", this.getToken())
            .sym.encrypt("pk", "sym", "pkcip", true);
        this.taPrivateKey = ic.get("pkcip");
    }



    /**
     * Called after topic authority restart
     * checks metadata hash and signature,
     * set id
     * @param metadata
     */
    setMetadata(metadata){
        if(!Metadata.isMetadataInstance(metadata)){
            throw new Error("Metadata must be instance of Metadata");
        }
        this.currentMetadata = metadata;
    }

    async loadMetadata(){
        const metadata = Metadata.parseMetadata(await this.hm.taGetLastMetadata(this.getPkfp()));
        this.setMetadata(metadata);
    }

    getCurrentMetadata(){
        return  Metadata.parseMetadata(JSON.stringify(this.currentMetadata));
    }

    setResidence(residence){
        this.residence = residence;
    }

    getResidence(){
        return this.residence;
    }

    getPkfp(){
        return this.pkfp;
    }

    setPkfp(pkfp = Err.required()){
        this.pkfp = pkfp;
    }

    setPublicKey(publicKey = Err.required()){
        this.publicKey = publicKey;
    }

    getPublicKey(){
        return this.publicKey;
    }

    getId(){
        return this.getPkfp();
    }

    refreshToken(){
        let ic = new iCrypto();
        ic.createSYMKey("sym");
        this.token = ic.get("sym");
    }

    getToken(){
        return this.token;
    }

}


module.exports = TopicAuthority;
