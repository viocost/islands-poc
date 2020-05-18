const Message  = require("./Message.js");
const iCrypto = require("../libs/iCrypto.js");

class ChatMessage extends Message{

    constructor(message){
        super();
        if(typeof(message) === "string"){
            message = JSON.parse(message);
        }
        this.headers = message.headers;
        this.body = message.body;
        this.signature = message.signature;
        if(message.travelLog){
            this.travelLog = message.travelLog;
        }
    }

    /**
     * Verifies client request
     * Resolves with boolean verified-true/not verified-false
     * @param publicKey
     * @param message
     * @returns {*}
     */
    static verifyMessage(publicKey, message){
        let valid = false;
        try{
            if (typeof (message) === "string"){
                message = JSON.parse(message);
            }
            let ic = new iCrypto();
            let requestString = JSON.stringify(message.headers) + JSON.stringify(message.body);

            ic.setRSAKey("pubk", publicKey, "public")
                .addBlob("sign", message.signature)
                .hexToBytes('sign', "signraw")
                .addBlob("b", requestString);
            ic.publicKeyVerify("b", "sign", "pubk", "v");
            valid = ic.get("v");
        } catch(err){
            console.log("Error verifying message: " + err);
        }
        return valid;
    }
}

module.exports = ChatMessage;
