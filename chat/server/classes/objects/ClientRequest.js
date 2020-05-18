const Message = require("./Message.js");
const iCrypto = require("../libs/iCrypto.js");
const Err = require("../libs/IError.js");

class ClientRequest extends Message{
    constructor(){
        super();
    }

    static isRequestValid(request, publicKey, opts = {}){
        if(!request.signature){
            throw new Error("Request verefication error: no signature found");
        }


        if(opts){
            if (opts.pkfpDest && !request.headers.pkfpDest){
                throw new Error("Request verefication error: no destination pkfp");
            }

            if (opts.pkfpSource && !request.headers.pkfpSource){
                throw new Error("Request verefication error: no origin pkfp");
            }

            if(opts.bodyContent){



            }
        }

        let ic = new iCrypto();
        ic.addBlob("request", JSON.stringify(request.headers) + JSON.stringify(request.body))
            .asym.setKey("pubk", publicKey, "public")
            .addBlob("sign", request.signature)
            .publicKeyVerify("request","sign", "pubk", "v");

        return  ic.get("v");

    }

    static signRequest(request = Err.required(), privateKey = Err.required()){
        let ic = new iCrypto();
        ic.addBlob("request", JSON.stringify(request.headers) + JSON.stringify(request.body))
            .asym.setKey("privk", privateKey, "private")
            .asym.sign("request", "privk", "sign");
        request.signature = ic.get("sign");
        return request;
    }

}

module.exports = ClientRequest;
