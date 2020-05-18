const iCrypto = require("../libs/iCrypto");
const Err = require("../libs/IError.js");
const CuteSet = require("cute-set");
const version = require ("../libs/Version");


class MetadataFactory{

    /**
     * Initializes new metadata object
     * Called on new topic creation
     * @param topicName
     */
    static createNewMetadata(){
        let metadata =  new Metadata();

        metadata.refreshId();
        metadata.body.timestamp = Date.now();
        return metadata;
    }

    static parseMetadata(blob){
        if(typeof blob === "string"){
            blob = JSON.parse(blob);
        }
        let metadata = new Metadata();
        for (let key of Object.keys(blob)){
            metadata[key] = blob[key];
        }
        return metadata
    }

    static isMetadataInstance(obj){
        return (obj instanceof Metadata)
    }

    /**
     * Given string or JSON object, creates new object type Participants,
     * fills all the properties from passed object according to Participant.properties
     * returns newly created object
     * @param participant
     * @returns {Participant}
     */
    static parseParticipant(participant = Err.required("metadata parseParticipant: missing required parameter 'participant'")){
        if(typeof(participant) === "string"){
            participant = JSON.parse(participant)
        }
        let p = new Participant();
        for (let prop of Participant.properties){
            p[prop] = participant[prop]
        }
        p.validate();
        return p;
    }

    static setOwner(metadata = Err.required("Metadata setOwner: missing required parameter 'metadata'"),
                    participant = Err.required("Metadata setOwner: missing required parameter 'participant'")){
        if(metadata.body.owner){
            throw new Error("metadata setOwner error: owner is already set to " + metadata.body.owner);
        }

        metadata.set("owner", participant.pkfp);
    }

    static addParticipant(metadata, participant){
        if(!MetadataFactory.isMetadataInstance(metadata)){
            throw new Error("metadata setOwner error: parameter metadata type is invalid");
        }
        metadata.addParticipant(participant);

    }

    static setTopicAuthority(metadata = Err.required("Metadata setTopicAuthority: missing required parameter 'metadata'"),
                             topicAuthority = Err.required("Metadata setTopicAuthority: missing required parameter 'topicAuthority'")){
        if(topicAuthority.publicKey === undefined){
            throw new Error("setTopicAuthority error: public key is missing")
        } else if(topicAuthority.pkfp === undefined){
            throw new Error("setTopicAuthority error: pkfp is missing")
        }else if(topicAuthority.residence === undefined){
            throw new Error("setTopicAuthority error: residence is missing")
        }

        metadata.body.topicAuthority = {
            publicKey: topicAuthority.publicKey,
            residence: topicAuthority.residence,
            pkfp: topicAuthority.pkfp
        }
    }

    static validateMetadata(blob){
        if (typeof(blob) === "string"){
            blob = JSON.parse(blob);
        }
        if(new Set([...new Set(Metadata.properties)].filter(a => !new Set(Object.keys(blob.body)).has(a))).size !== 0){
            throw new Error("Metadata validation error: number of required properties is invalid.");
        }

        for (let prop of Metadata.properties){
            if (blob.body[prop] === undefined){
                throw new Error("Metadata validation error: missing required property '" + prop + "'");
            }
        }
    }

    static createNewParticiapnt(publicKey, residence, rights = 2, key){
        let ic = new iCrypto();
        ic.asym.setKey("pubk", publicKey, "public")
            .getPublicKeyFingerprint("pubk", "pkfp");
        let p = new Participant();
        p.set("publicKey", publicKey);
        p.set("residence", residence);
        p.set("rights", rights);
        p.set("pkfp", ic.get("pkfp"));
        p.set("key", key ? key : "pending" );
        return p;
    }

}

class Metadata{

    constructor() {
        this.body = {};
        this.body.participants = {};
        this.body.topicAuthority = {};
        this.signature = "";
        this.body.version = version.getVersion();
    }

    /**
     * Adds participant to list of participants
     *
     */
    addParticipant(participant){
        if(!(participant instanceof Participant)){
            throw new Error("addParticpant error: participant type is invalid");
        }
        participant.validate();
        this.body.participants[participant.pkfp] = participant;
    }


    removeParticipant(pkfp = Err.required("Metadata removeParticipant set: - missing required parameter 'pkfp'")){
        if(!this.body.participants.hasOwnProperty(pkfp)){
            throw new Error("Metadata removeParticipant error: participant does not exist");
        }
        delete this.body.participants[pkfp];
    }

    _setStatus(status){
        let statuses = new CuteSet(["sealed", "active"])
        if(!statuses.has(status)){
            throw new Error("Error setting metadata status: status is invalid");
        }

        this.body.status = status;
    }

    seal(){
       this._setStatus("sealed");
       return this;
    }

    setSharedKeySignature(signature = Err.required("Metadata setSharedKeySignature set: - missing required parameter 'signature'")){
        this.body.sharedKeySignature = signature;
    }

    refreshId(){
        let ic = new iCrypto();
        ic.createNonce("n", 16)
            .bytesToHex("n", "nhex");
        this.body.id = ic.get("nhex");
    }

    getParticipantResidence(pkfp){
        return this.body.participants[pkfp].residence;
    }


    getParticipantPublicKey(pkfp){
        return this.body.participants[pkfp].publicKey;
    }

    getTopicAuthorityResidence(){
        return this.body.topicAuthority.residence;
    }

    getTopicAuthorityPublicKey(){
        return this.body.topicAuthority.publicKey;
    }

    getTopicAuthorityPkfp(){
        return this.body.topicAuthority.pkfp;
    }

    toBlob(){
        return JSON.stringify(this);
    }

    setSettings(settings = Err.required()){
        this.body.settings = settings;
    }

    set(prop = Err.required("Metadata set: - missing required parameter 'prop'"),
        value = Err.required("Metadata set: - missing required parameter 'val'")){
        if (!Metadata.properties.includes(prop)){
            throw 'Metadata.set: invalid property "' + prop + '"';
        }
        this.body[prop] = value;
    }

    get(prop = Err.required("Participant get: - missing required parameter 'prop'")){
        if (!Object.keys(this.body).includes(prop)){
            throw new Error("Metadata.get: invalid property '" + prop + "'");
        }
        if (!this.body[prop]){
            throw new Error("Metadata.get: property '" + prop + "' is not initialized");
        }
        return this.body[prop];
    }

}

Metadata.properties = ["participants", "id", "timeStamp", "owner", "sharedKeySignature", "topicAuthority"];



class Participant{

    set(prop = Err.required("Participant set: - missing required parameter 'prop'"),
        value = Err.required("Participant set: - missing required parameter 'val'")){
        if (!Participant.properties.includes(prop)){
            throw 'Participant.set: invalid property "' + prop + '"';
        }
        this[prop] = value;
    }

    get(prop = Err.required("Participant get: - missing required parameter 'prop'")){
        if (!Object.keys(this).includes(prop)){
            throw new Error("Participant.get: invalid property '" + prop + "'");
        }
        if (!this[prop]){
            throw new Error("Participant.get: property '" + prop + "' is not initialized");
        }
        return this[prop];
    }

    validate(){
        //Verifying attributes
        if(new Set([...new Set(Participant.properties)].filter(a => !new Set(Object.keys(this)).has(a))).size > 1){
           throw new Error("Participant validation error: number of required properties is invalid.");
        }
        for (let prop of Participant.properties){
            if (!this[prop]){
                throw new Error("Participant validation error: missing required property: " + prop);
            }
        }
    }

}

Participant.properties = ["publicKey", "pkfp", "residence", "key", "rights"];

module.exports = MetadataFactory;
