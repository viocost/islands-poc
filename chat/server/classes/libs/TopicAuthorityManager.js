const TopicAuthority = require("../objects/TopicAuthority.js");
const Err = require("./IError.js");
const iCrypto = require("./iCrypto.js");
const Util = require("./ChatUtility.js");
const Envelope = require("../objects/CrossIslandEnvelope.js");
const ServiceMessage = require("../objects/ServiceMessage.js");
const SSet = require("cute-set");
const Logger = require("./Logger.js");


class TopicAuthorityManager{
    constructor(crossIslandMessenger = Err.required(),
                connector = Err.required(),
                historyManager){

        this.topicAuthorities = {};
        this.crossIslandMessenger = crossIslandMessenger;
        this.connector = connector;
        this.historyManager = historyManager;
    }

    /**
     * Instantiates and launches new Topic Authority instance
     * Called when new topic created
     * returns RAW keypair which must be encrypted persisted and saved
     * In order to re-launch the same topic autority with same parameters -
     * private key and hidden service private key will be required.
     * @param historyManager
     * @returns {Promise<void>}
     */
    async createTopicAuthority(clientPkfp = Err.required(),
                               clientPublicKey = Err.required(),
                               clientResidence = Err.required(),
                               taPrivateKey = Err.required()){

        //Create hidden service
        const serviceData = await this.connector.createHiddenService();
        const taResidence = serviceData.serviceID + ".onion";

        //bake and initialize new TopicAuthority
        const ta = new TopicAuthority(this.historyManager);
        await ta.initialize(clientPublicKey, clientResidence, taPrivateKey, taResidence);

        //Encrypt and  persist HS private key
        this.historyManager.taSaveHsPrivateKey(ta.getPkfp(), Util.encryptStandardMessage(serviceData.privateKey, clientPublicKey));

        //Register active topic authority
        this.registerTopicAuthority(ta);

        //Return its ID
        return ta.getPkfp();
    }

    registerTopicAuthority(ta){
        let id = ta.getId();
        this.topicAuthorities[id] = ta;
        ta.on("metadata_issue", async  (data) =>{
            await this.sendOutNewMetadata(data, ta);
        })
        ta.on("send_notice", async(data)=>{
            await this.sendNotice(data, ta)
        })
    }

    /**
     * Checks topic authority and its hidden service, then launches them
     * @param taPrivateKey
     * @param taHSPrivateKey
     */
    async launchTopicAuthority(taPrivateKey = Err.required(),
                         taHSPrivateKey = Err.required(),
                         taPkfp = Err.required()){
        Logger.debug("About to launch topic authority: " + taPkfp);
        await this.connector.checkLaunchIfNotUp(taHSPrivateKey);
        const ta = new TopicAuthority(this.historyManager);
        ta.encryptCachePrivateKey(taPrivateKey);
        ta.setKeysFromPrivate(taPrivateKey);
        ta.setResidence(iCrypto.onionAddressFromPrivateKey(taHSPrivateKey));
        await ta.loadMetadata();
        ta.loadInviteIndex();
        this.registerTopicAuthority(ta);
        Logger.debug("Topic authority was launched");
    }


    getTopicAuthority(taPkfp){
        if (!this.isTopicAuthorityLaunched(taPkfp)){
            let launchedTAs = Object.keys(this.topicAuthorities).join(", ");
	    Logger.warn("Topic authority is not launched: " + taPkfp + " launched TAs: " + launchedTAs);
            throw new Error("Topic authority is not launched: " + taPkfp);
        }
        return this.topicAuthorities[taPkfp];
    }


    getTopicAuthorityPrivateKey(taPkfp){
        return this.historyManager.getTopicKey(taPkfp, "taPrivateKey")
    }

    getTopicAuthorityHSPrivateKey(taPkfp){
        return this.historyManager.getTopicKey(taPkfp, "taHSPrivateKey")
    }




    /************************************************************
     * Helpers
     ************************************************************/

    async sendNotice(data, topicAuthority){
        topicAuthority.signMessage(data.notice);
        let envelope = new Envelope(data.residence, data.notice, topicAuthority.getResidence())
        await this.crossIslandMessenger.send(envelope)
    }

    async sendOutNewMetadata(data, topicAuthority){
        //invite is invite string that was used by invitee
        // pkfp  - refers to invitee's pkfp
        // This properties applied only for cases when new member joins topic
        let { metadata, recipients, invite, pkfp } = data
        console.log("***********SENDING OUT NEW METADATA*************");

        const taPkfp = metadata.getTopicAuthorityPkfp();
        const metaBlob = metadata.toBlob();

        if (!recipients || recipients.length === 0){
            console.log("No recipients specified. Returning..");
            return
        }

        for(let participant of recipients){
            console.log("Sending metadata to: " + participant);
            let message = new ServiceMessage(taPkfp, participant, "metadata_issue");
            message.headers.event = data.event;
            message.setAttribute("metadata", metaBlob);
            if(invite){
                //setting invite string
                message.setAttribute("invite", invite);
            }
            if(pkfp){
                message.setAttribute("inviteePkfp", pkfp);
            }
            //adding event-specific fields
            message = this._getMetaIssueMessageConstructor(data.event)(message, data);
            message = topicAuthority.signRequestOnMetadataIssue(message);
            let envelope = new Envelope(metadata.body.participants[participant].residence,
                message,
                metadata.getTopicAuthorityResidence());
            await this.crossIslandMessenger.send(envelope);
        }
    }

    _prepareMessageOnMemberJoin(message, data){
        message.body.nickname = data.nickname;
        message.body.pkfp = data.pkfp;
        return message;
    }

    _prepareMessageOnMemberBoot(message, data){
        message.body.bootedPkfp = data.bootedPkfp;
        return message;
    }

    _getMetaIssueMessageConstructor(event){
        let constructors = {
            "new_member_joined": this._prepareMessageOnMemberJoin,
            "member_booted": this._prepareMessageOnMemberBoot
        };
        return constructors[event];
    }


    isTopicAuthorityLaunched(taPkfp){
	Logger.debug("checking if topic authority is launched: " + taPkfp);
        return this.topicAuthorities.hasOwnProperty(taPkfp);
    }

    async isTaHiddenServiceOnline(taPkfp){
        const ta = this.getTopicAuthority(taPkfp);
        const residence = ta.getResidence();
        console.log("============= Checking TA residence on login: " + residence);
        return await this.connector.isHSUp(residence);
    }


}

module.exports = TopicAuthorityManager;





