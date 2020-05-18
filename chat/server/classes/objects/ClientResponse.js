const Message = require("./Message.js");
const Err = require("../libs/IError.js");
const iCrypto = require("../libs/iCrypto.js");

class ClientResponse extends Message{
    /**
     *
     * @param response String - response code to send to client
     * @param request - original Client request
     */
    constructor(response = Err.required(), request){
        super();
        if(request){
            this.headers = JSON.parse(JSON.stringify(request.headers));
            this.body = JSON.parse(JSON.stringify(request.body));
            this.signature = JSON.parse(JSON.stringify(request.signature));
        }
        this.setResponse(response);
    }

    setResponse(response){
        this.headers.response = response;
    }

    static signResponse(response = Err.required(), privateKey = Err.required()){
        let ic = new iCrypto();
        ic.addBlob("request", JSON.stringify(response.headers) + JSON.stringify(response.body))
            .asym.setKey("privk", privateKey, "private")
            .asym.sign("request", "privk", "sign");
        response.signature = ic.get("sign");
        return response;
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

module.exports = ClientResponse;