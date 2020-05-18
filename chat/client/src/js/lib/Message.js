import { iCrypto } from "./iCrypto"
import { IError as Err  } from "../../../../common/IError"


/**
 * Message is the major data type used for client-server-client communication
 * 
 * 
 * 
 * Possible headers:
 *  command: used mainly between browser and island
 *  response: island response to browser. This is an arbitrary string by which
 *         sender identifies the outcome of the request. Can be an error code like login_error
 *  error: error message if something goes wrong it should be set. If it is set -
 *              the response treated as an error code
 *  pkfpSource: public key fingerprint of the sender
 *  pkfpDest: public key fingerprint of the recipient
 *
 *
 */
export class Message{
    constructor(version, request){
        if(version === undefined || version === "") throw new Error("Message init error: Software version is required!");

        if(typeof(request)==="string"){
            request = JSON.parse(request);
        }
        this.headers = request ? this.copyHeaders(request.headers) : {
            command: "",
            response: "",
            version: version
        };

        this.body = request ? request.body : {};
        this.signature = request ? request.signature : "";
    }


    static verifyMessage(publicKey, message){
        let ic = new iCrypto();
        let requestString = JSON.stringify(message.headers) + JSON.stringify(message.body);
        ic.setRSAKey("pubk", publicKey, "public")
            .addBlob("sign", message.signature)
            .hexToBytes('sign', "signraw")
            .addBlob("b", requestString);
        ic.publicKeyVerify("b", "sign", "pubk", "v");
        return ic.get("v");
    }


    static createRequest(version = Err.required("Version"),
                         pkfpSource = Err.required("pkfpSource"),
                         command = Err.require("command"),
                         pkfpDest,
                         body){
        let request = new Message(version);
        request.setSource(pkfpSource);
        request.setCommand(command);
        if(pkfpDest){
            request.setDest(pkfpDest)
        }

        if (body){
            for (let key of Object.keys(body) ){
                request.body[key] = body[key];
            }
        }

        return request;
    }

    setError(error){
        this.headers.error = error || "Unknown error";
    }

    setResponse(response){
        this.headers.response = response;
    }

    copyHeaders(headers){
        let result = {};
        let keys = Object.keys(headers);
        for (let i=0; i< keys.length; ++i){
            result[keys[i]] = headers[keys[i]];
        }
        return result;
    }

    setVersion(version){
        if(version === undefined || version === "") throw new Error("Error setting message version: version undefined");
        this.headers.version = version;
    }

    signMessage(privateKey){
        let ic = new iCrypto();
        let requestString = JSON.stringify(this.headers) + JSON.stringify(this.body);
        ic.addBlob("body", requestString)
            .setRSAKey("priv", privateKey, "private")
            .privateKeySign("body", "priv", "sign");
        this.signature = ic.get("sign");
    }


    setAttribute(attr=Err.required("Attribute name"), value){
        this.body[attr] = value;
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

    setHeader(k=Err.required("k"), v=Err.required("v")){
        this.headers[k]=v;
    }

    addNonce(){
        let ic = new iCrypto();
        ic.createNonce("n")
            .bytesToHex("n", "nhex");
        this.headers.nonce = ic.get("nhex");
    }

    get  (name){
        if (this.keyExists(name))
            return this[name];
        throw new Error("Property not found");
    };

    set (name, value){
        if (!Message.properties.includes(name)){
            throw 'Invite: invalid property "' + name + '"';
        }
        this[name] = value;
    };

}

Message.properties = ["headers", "body", "signature"];

