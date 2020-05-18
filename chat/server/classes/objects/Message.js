const Err = require("../libs/IError.js");
const iCrypto = require("../libs/iCrypto.js");

class Message{
    constructor(){
        this.headers = {};
        this.body = {};
        this.signature = "";
    }

    static parse(message){
        let data = message;
        if(typeof(message) === "string"){
            data = JSON.parse(message);
        }
        let res = new Message();
        res.headers = data.headers;
        res.body = data.body;
        res.signature = data.signature;
        return res;
    }

    static getCommand(message){
        const m = Message.parse(message);
        return m.headers.command;
    }

    static makeResponse(origMessage, pkfpSource, command){
        let message = new Message();
        message.setDest(origMessage.headers.pkfpSource);
        message.setSource(pkfpSource)
        message.setCommand(command);
        return message;
    }


    setAttribute(key = Err.required(), value = Err.required()){
        if(this.body[key]){
            throw new Error("Cannot set message attribute '" + key + "', it already exists");
        }
        this.body[key] = value;
    }

    getKeys(){
        return Object.keys(this.body);
    }

    getHeaders(){
        return this.headers;
    }

    hasAttribute(attr){
        return this.body[attr] !== undefined;
    }

    setHeader(key = Err.required(), val = Err.required()){
        this.headers[key] = val;
    }

    toBlob(){
        return JSON.stringify(this);
    }


    hasHeader(header){
        return this.headers[header];
    }

    setSource(pkfp){
        this.headers.pkfpSource = pkfp;
    }

    setDest(pkfp){
        this.headers.pkfpDest = pkfp;
    }

    setCommand(command){
        this.headers.command = command
    }

    addNonce(){
        let ic = new iCrypto();
        ic.createNonce("n")
            .bytesToHex("n", "nhex");
        this.headers.nonce = ic.get("nhex");
    }

    signMessage(privateKey){
        let ic = new iCrypto();
        let requestString = JSON.stringify(this.headers) + JSON.stringify(this.body);
        ic.addBlob("body", requestString)
            .setRSAKey("priv", privateKey, "private")
            .privateKeySign("body", "priv", "sign");
        this.signature = ic.get("sign");
    }

    static verify(message, publicKey){
        let ic = new iCrypto();
        ic.addBlob("request", JSON.stringify(message.headers) + JSON.stringify(message.body))
            .asym.setKey("pubk", publicKey, "public")
            .addBlob("sign", message.signature)
            .publicKeyVerify("request","sign", "pubk", "v");
        return  ic.get("v");
    }
}



module.exports = Message;
