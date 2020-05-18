const mocha = require('mocha');
const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const HistoryManager = require("../classes/libs/HistoryManager");

const iCrypto = require("../classes/libs/iCrypto");


describe("icrypto", ()=>{
    it("Should create randome message, sign and verify it", ()=>{
        let ic = new iCrypto;
        ic.generateRSAKeyPair("kp")
            .createNonce("n")
            .bytesToHex("n", "nh")
            .getPublicKeyFingerprint("kp", "pkfp");


        let m = new Message();
        m.headers.pkfpSource = ic.get("pkfp");
        m.headers.pkfpDest = ic.get("pkfp");
        m.headers.command = "shout_message";
        m.body.message = ic.get("nh");
        m.signMessage(ic.get("kp").privateKey);

        let stringed = JSON.stringify(m);

        let m2 = new Message(stringed);


        let verified = m2.verifyMessage(ic.get("kp").publicKey);
        assert(verified);
    }).timeout(8000)

});



class Message{
    constructor(request){
        if(typeof(request)==="string"){
            request = JSON.parse(request);
        }
        this.headers = request ? request.headers :{
            command: "",
            response: ""
        };
        this.body = request ? request.body : {};
        this.signature = request ? request.signature : "";
    }

    setError(error){
        this.headers.error = error || "Unknown error";
    }

    setResponse(response){
        this.headers.response = response;
    }

    signMessage(privateKey){
        let ic = new iCrypto();
        let requestString = JSON.stringify(this.headers) + JSON.stringify(this.body);
        ic.addBlob("body", requestString)
            .setRSAKey("priv", privateKey, "private")
            .privateKeySign("body", "priv", "sign");
        this.signature = ic.get("sign");
    }

    verifyMessage(publicKey){
        let ic = new iCrypto();
        let requestString = JSON.stringify(this.headers) + JSON.stringify(this.body);

        ic.setRSAKey("pubk", publicKey, "public")
            .addBlob("sign", this.signature)
            .addBlob("b", requestString);
       // console.log("Request string before verifying: " + requestString);

        ic.publicKeyVerify("b", "sign", "pubk", "v");
        return ic.get("v");
    }

    get  (name){
        if (this.keyExists(name))
            return this[name];
        throw new Error("Property not found");
    };

    set (name, value){
        if (!Message.properties.includes(name)){
            throw new Error('Invite: invalid property "' + name + '"');
        }
        this[name] = value;
    };

}

Message.properties = ["headers", "body", "signature"];
