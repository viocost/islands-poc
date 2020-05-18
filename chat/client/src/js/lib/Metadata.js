import { iCrypto } from "./iCrypto"
import { assert, IError as Err } from "../../../../common/IError";
import { ClientSettings } from "./ClientSettings";
import { ChatUtility } from "./ChatUtility";

export class Metadata{
    static parseMetadata(blob){
        if(typeof (blob) === "string"){
            return JSON.parse(blob);
        }else{
            return blob;
        }
    }

    static isMetadataValid(metadata){

        if (typeof metadata === "string"){
            metadata = JSON.parse(metadata);
        }
        let ic = new iCrypto();
        ic.setRSAKey("pub", metadata.body.topicAuthority.publicKey, "public")
          .addBlob("body", JSON.stringify(metadata.body))
          .addBlob("sign", metadata.signature)
          .publicKeyVerify("body", "sign", "pub", "res")
        return ic.get("res");
    }

    //Parses metadata blob and decrypts settings if found
    static fromBlob(metadata = Err.required(), privateKey){
        let parsed = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
        let res = new Metadata();

        res.body = parsed.body;
        res.signature = parsed.signature;
        if (parsed.body.settings){
            assert(privateKey, "No Private key to decrypt settings")
            res.body.settings = res.decryptSettings(parsed.body.settings, privateKey);
        } else {
            console.log("Warning! Metadata without settings!")
            res.body.settings = res.initializeSettings();
        }

        return res;
    }

    decryptSettings(settings = Err.required("settings"),
                    privateKey = Err.required("privateKey")){
      return JSON.parse(ChatUtility.decryptStandardMessage(settings, privateKey))
    }

    encryptSettings(publicKey = Err.required("publicKey"), settings = Err.required("settings")){
        if(typeof settings === "object"){
            settings = JSON.stringify(settings);
        }
        return ChatUtility.encryptStandardMessage(settings, publicKey);
    }

    getSharedKey(privateKey){

        return ChatUtility.privateKeyDecrypt(this.body.participants[this.pkfp].key, this.privateKey);
    }


    constructor(){
        this.body = {
            id: "",
            timestamp: "",
            owner: "",
            sharedKeySignature: "",
            participants: {},
            topicAuthority: {},
            settings: {
                version: "",
                membersData: {},
                invites: {}
            }
        }
        this.signature;
    }

    setParticipantAlias(alias = Err.required("alias"), pkfp){
        assert(this.body.participants.hasOwnProperty(pkfp), `Participant ${pkfp} not found`)
        if (!this.body.settings.membersData.hasOwnProperty(pkfp)){
            this.body.settings.membersData[pkfp] = {}
        }
        this.body.settings.membersData[pkfp].alias = alias;
    }

    hasParticipant(pkfp){
        return this.body.participants.hasOwnProperty(pkfp);
    }

    setParticipantNickname(nickname = Err.required("nickname"), pkfp = Err.required("pkfp")){
        assert(this.body.participants.hasOwnProperty(pkfp), `Participant ${pkfp} not found`)
        if (!this.body.settings.membersData.hasOwnProperty(pkfp)){
            this.body.settings.membersData[pkfp] = {}
        }
        this.body.settings.membersData[pkfp].nickname = nickname;
    }

    getParticipantAlias(pkfp){
        if(!pkfp){
            pkfp = this.body.owner;
        }
        return this.body.settings.membersData[pkfp].alias
    }


    getParticipantNickname(pkfp = Err.required("pkfp")){
        return this.body.settings.membersData[pkfp].nickname
    }

    getParticipantPublicKey(pkfp){
        assert(this.body.participants.hasOwnProperty(pkfp), `Participant ${pkfp} not found`)
        return this.body.participants[pkfp].publicKey;
    }


    addInvite(inviteCode = Err.required("inviteCode"), name = ""){
        this.body.settings.invites[inviteCode] =  {
            name: name
        }
    }

    deleteInvite(inviteCode = Err.required("inviteCode")){
        delete this.body.settings.invites[inviteCode];
    }

    getInvites(){
        return JSON.parse(JSON.stringify(this.body.settings.invites));
    }

    hasInvite(inviteCode){
        return this.body.settings.invites.hasOwnProperty(inviteCode);
    }

    setInviteAlias(inviteCode, name){
        assert(this.hasInvite(inviteCode), "Invite is not found")
        this.body.settings.invites[inviteCode] =  {
            name: name
        }
    }

    updateMetadata(newMetadata){
        //assert(Metadata.isMetadataValid(newMetadata), "Metadata is invalid")
        console.log("Updating metadata...");
        if(typeof newMetadata === "string"){
            newMetadata = JSON.parse(newMetadata);
        }
        this.body.participants = JSON.parse(JSON.stringify(newMetadata.body.participants));


        this.body.settings.membersData = ChatUtility.syncMap(Object.keys(this.body.participants),
                                                             this.body.settings.membersData,
                                                             {nickname: "Unknown"});
        this.body.id = newMetadata.body.id;
        this.body.timestamp = newMetadata.body.timestampa;
        this.body.sharedKeySignature = newMetadata.body.sharedKeySignature;
        this.signature = newMetadata.signature;
    }

    updateInvites(invites){
        this.body.settings.invites = ChatUtility.syncMap(invites, this.body.settings.invites, {name: ""});
    }

    updateSettings(settings){
        assert(typeof settings === "object", "Settings are of invalid type.")
        let currentParticipants = Object.keys(this.body.participants)
        this.body.settings.membersData = ChatUtility.syncMap(currentParticipants, settings.membersData, {nickname: "Unknown"})
        this.body.settings.invites = settings.invites;
        this.body.settings.version = settings.version;
    }

    getId(){
        return this.body.id;
    }

    getSharedKey(pkfp = Err.required("pkfp"),
                 privateKey = Err.required("privateKey")){
        return ChatUtility.privateKeyDecrypt(this.body.participants[pkfp].key, privateKey);
    }

    getSettingsEncrypted(privateKey = Err.required()){
        let ic = new iCrypto();
        ic.asym.setKey("privk", privateKey, "private")
            .publicFromPrivate("privk", "pub")
        let publicKey = ic.get("pub");

        let settings = JSON.stringify(this.body.settings);
        let settingsEnc = ClientSettings.encrypt(publicKey, settings);

        ic.addBlob("cipher", settingsEnc)
          .privateKeySign("cipher", "privk", "sign")

        return {
            settings: settingsEnc,
            signature: ic.get("sign")
        }
    }

    getTAPublicKey(){
        return this.body.topicAuthority.publicKey
    }

    getTAPkfp(){
        return this.body.topicAuthority.pkfp
    }


    initializeSettings(version = "2.0.0"){
        return {
            version: version,
            membersData: {},
            invites : {}
        }
    }
}
