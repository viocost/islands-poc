import { iCrypto } from "./iCrypto";
import { Message } from "./Message";
import { WildEmitter } from "./WildEmitter";
import { Topic } from "./Topic";
import { Events, Internal } from "../../../../common/Events";
import { ChatUtility } from "./ChatUtility";

export class TopicJoinAgent{

    constructor(nickname, topicName, inviteString, arrivalHub, messageQueue, vault){
        WildEmitter.mixin(this);
        this.nickname = nickname;
        this.topicName = topicName;
        this.inviteString = inviteString;
        this.messageQueue = messageQueue;
        this.arrivalHub = arrivalHub;
        this.vault = vault
        this.version = vault.version
        this.pkfp = null
        this.publicKey = null
        this.privateKey = null
        this.inviterResidence = null
        this.inviterPkfp = null
        this.inviteCode = null
    }

    /**
     * Called on INVITEE side when new user joins a topic with an invite code
     * @param nickname
     * @param inviteCode
     * @returns {Promise}
     */
    start(){
        let self = this;
        setTimeout(()=>{

            let start = new Date();
            console.log("joining topic with nickname: " + self.nickname + " | Invite string: " + self.inviteString);

            console.log(`Preparing keys...`);

            let cryptoStart = new Date()
            let ic = new iCrypto();
            ic.asym.createKeyPair("rsa")
                .getPublicKeyFingerprint('rsa', 'pkfp')
                .addBlob("invite64", self.inviteString.trim())
                .base64Decode("invite64", "invite");

            self.pkfp = ic.get("pkfp")
            self.publicKey = ic.get("rsa").publicKey;
            self.privateKey = ic.get("rsa").privateKey;

            let callStart = new Date()
            let invite = ic.get("invite").split("/");
            self.inviterResidence = invite[0];
            self.inviterPkfp = invite[1];
            self.inviteCode = invite[2];

            if(!self.inviteCode || !self.inviterPkfp || !(/^[a-z2-7]{16}\.onion$/.test(self.inviterResidence)))
                throw new error("Invite request is invalid")

            // Encrypted vault record
            console.log(`Topic name is: ${self.topicName}`);
            let vaultRecord = self.vault.prepareVaultTopicRecord(self.version,
                                                                 self.pkfp,
                                                                 self.privateKey,
                                                                 self.topicName)
            let vault = JSON.stringify({
                record: vaultRecord,
                id: self.vault.id
            })

            console.log("Encrypting vault record...");

            ic.addBlob("vlt-rec", vault)
            .setRSAKey("priv", self.vault.privateKey, "private")
            .privateKeySign("vlt-rec", "priv", "vlt-sign")


            let request = new Message(self.version);
            request.setCommand(Internal.JOIN_TOPIC);
            request.setSource(self.pkfp);
            request.setDest(self.inviterPkfp);
            let body = {
                inviteString: self.inviteString,
                inviteCode: self.inviteCode,
                destination: self.inviterResidence,
                invitee:{
                    publicKey: self.publicKey,
                    pkfp: self.pkfp
                }
            };

            request.set("body", body);
            request.vaultSign = ic.get("vlt-sign");
            request.vault = vault;
            request.signMessage(self.privateKey);
            console.log("Sending topic join request");
            let sendStart = new Date();

            self.arrivalHub.on(self.inviteCode.trim(), (msg)=>{ self.processServerMessage(self, msg)})
            self.arrivalHub.on(Events.JOIN_TOPIC_FAIL, (msg)=>{ self.onJoinTopicFail(self, msg)})
            console.log("Sending join request");
            self.messageQueue.enqueue(request);
        }, 100)
    }

    processServerMessage(self, msg){
        console.log("Join agent got message from the server");
        console.log(msg.headers.command)
        switch (msg.headers.command){
            case Internal.JOIN_TOPIC_SUCCESS:
                self.onJoinTopicSuccess(self, msg);
                break
            case Internal.JOIN_TOPIC_FAIL:
                self.onJoinTopicFail(self, msg)
                break
            default:
                console.log("Unkonwn event.")
        }
    }

    notifyJoinSuccess(request, self){
        console.log("Join successfull received!");
        self.emit("topic_join_success", {
            pkfp: topicInfo.pkfp,
            nickname: topicInfo.nickname,
            privateKey: topicInfo.privateKey
        });
    }

    onJoinTopicSuccess(self, msg){
        let topic = new Topic(self.version, self.pkfp, self.topicName, self.privateKey);
        if (!msg.body.metadata){
            console.log("Error. No metadata.");
        }

        let metadata = msg.body.metadata;
        topic.loadMetadata(metadata);
        topic.bootstrap(self.messageQueue, self.arrivalHub, self.version)
        console.log(`Preparing settings with nickname ${self.nickname}`);
        topic.setParticipantNickname(self.nickname, self.pkfp);
        self.vault.registerTopic(topic);
        topic.exchangeNicknames();

        self.emit(Internal.JOIN_TOPIC_SUCCESS, {
            pkfp: self.pkfp,
            nickname: self.nickname
        })
    }

    onJoinTopicFail(self, msg){
        console.log(`Join topic attempt has failed: ${msg.body.errorMsg}`);
        return
    }

        // this.handlers[Internal.JOIN_TOPIC_SUCCESS] = (msg)=>{                   //
        //     console.log("Topic join success! Adding new topic...");             //
        //     let topicPkfp = self.addNewTopic(self, msg);                        //
        //     self.vault.topics[topicPkfp].exchangeNicknames()                    //
        //                                                                         //
        //                                                                         //
        //                                                                         //
        // }                                                                       //
        //                                                                         //
        // this.handlers[Internal.JOIN_TOPIC_FAIL] = (msg)=>{                      //
        //     console.log(`Join topic attempt has failed: ${msg.body.errorMsg}`); //
        // }                                                                       //
}
