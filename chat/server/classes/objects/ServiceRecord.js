const Err = require("../libs/IError.js");
const iCrypto = require("../libs/iCrypto.js");
const Util = require("../libs/ChatUtility.js");


class ServiceRecord{
    constructor(pkfp = Err.required(),
                event = Err.required(),
                message = Err.required()){
        this.header = {};
        this.setHeader("timestamp",  new Date());
        this.setHeader("id", iCrypto.createRandomHexString(16));
        this.setHeader("pkfp", pkfp);
        this.setHeader("service", true);
        this.setHeader("event", event);
        this.setBody(message)
    }

    setHeader(k = Err.required(), v = Err.required()){
        this.header[k] = v
    }

    setBody(message){
        this.body = message
    }

    toBlob(){
        return JSON.stringify(this);
    }

    encrypt(publicKey = Err.required()){
        this.body = Util.encryptStandardMessage(this.body, publicKey);
    }

}

module.exports = ServiceRecord;