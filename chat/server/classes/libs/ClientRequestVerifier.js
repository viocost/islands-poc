const iCrypto = require("./iCrypto.js");


class ClientRequestVerifier{

    verify(request, publicKey){
        if(!request.signature){
            throw new Error("Request verefication error: no signature found");
        }

        let ic = new iCrypto();
        ic.addBlob("request", JSON.stringify(request.headers) + JSON.stringify(request.body))
            .asym.setRSAKey("pubk", publicKey, "public")
            .addBlob("sign", request.signature)
            .publicKeyVerify("request","sign", "pubk", "v");
        if(!ic.get("v")){
            throw new Error("Request was not verified");
        }
    }

}

module.exports = ClientRequestVerifier;
