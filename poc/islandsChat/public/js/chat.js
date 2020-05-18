//requires iCrypto to be present
//const iCrypto = require ("./iCrypto");

class Chat{

    /**
     *
     * @param {Object} topicData
     *  a structure that contains required data for topic load or creation
     *  if topic is new - structure should contain following:
     *      topicName - String
     *      nickname - String (nickname choosen by creator)
     *  otherwise:
     *      topicID - to locate history file and load metadata from it     *
     */
    constructor(topicData, isTopicNew = false){
        this.metadata = new Meatadata();
        this.sharedKey = null;
        this.publicKey = null;
        this.privateKey = null;
        this.topicID = null;
        newTopic ? this.initTopic(topicData) : this.loadTopic(topicData);

    }

    /**
     * Initiates new topic as an encrypted blob
     * and uploads data to the store on the island
     */
    initTopic(topicData){
        if (!newTopicDataValid(topicData))
            throw "Topic data is invalid";

        let ic = new iCrypto();
        ic.createSYMKey("s")
            .base64Encode("s", "sb")
            .generateRSAKeyPair("kp")
            .createNonce("nc")
            .base64Encode("nc", "nb");
        this.publicKey = ic.get("kp").publicKey;
        this.privateKey = ic.get("kp").privateKey;
        this.sharedKey = ic.get("sb");
        this.topicID = ic.get("nb");

        this.metadata.timeStamp = new Date();
        this.metadata.topicName = topicData.topicName;
        //this.metadata.sharedSecret = topicData.sharedSecret;
        this.metadata.topicID = this.topicID;

    }


    /**
     * Loads topic from data store on island
     * in form of encrypted blob, decrypts it
     * and parses it into metadata object
     */
    loadTopic(topicID){

    }


    /**
     * Creates invite code,
     * broadcasts update metadata with newly created code
     * updates own metadata
     */
    createInvite(){

    }

    /**
     * Accepts invite, initiates own history file and metadata record
     * broadcasts invite accepted
     */
    acceptInvite(){

    }

    shoutMessage(){

    }

    whisperMessage(){

    }


    newTopicDataValid(topicData){
        return true;
    }

    generateNewTopicID(){
        let ic = new iCrypto();
        ic.createNonce("n").base64Encode("n", "nb");
        return ic.get("nb");
    }

}


/**
 * Message processor functionality
 */
class MessageProcessor{


}

class Message{

}


class Participant{

    constructor(data){
        if (data){
            this.nickname = data.nickname;
            this.publicKey = data.publicKey;
            this.rights = data.rights;
            this.residence = data.residence;
        }
    }

    setNickname(nickname){
        this.nickname = nickname;
    }

    setPublicKey(publicKey){
        this.publicKey = publicKey;
    }

    setRights(rights){
        this.rights = rights;
    }

    setResidence(residence){
        this.residence = residence;
    }

}


class WrapupRecord{

}


class Metadata{

    constructor(blob = null){
        this.timestamp = null;
        this.topicID = null;
        this.topicName = null;
        this.sharedSecret = null;
        this.participants = {}
    }

    addParticipant(){

    }

    removeParticipant(){

    }



}