import { WildEmitter } from "./WildEmitter";
import { Message } from "./Message";
import { Internal, Events } from "../../../../common/Events";

export class BootParticipantAgent{
    constructor(topic, bootCandidatePkfp, messageQueue){
        WildEmitter.mixin(this);
        this.topic = topic;
        this.bootCandidatePkfp = bootCandidatePkfp;
        this.messageQueue = messageQueue;
    }

    boot(){
        setTimeout(()=>{
            console.log("Sending boot request");
            let request = new Message(this.topic.version);
            request.setCommand(Internal.BOOT_PARTICIPANT);
            request.setSource(this.topic.pkfp)
            request.setDest(this.topic.getMetadata().getTAPkfp());
            request.setAttribute("pkfp", this.bootCandidatePkfp)
            request.signMessage(this.topic.privateKey);
            this.messageQueue.enqueue(request)
            console.log("request sent");
        }, 100)
    }



}
