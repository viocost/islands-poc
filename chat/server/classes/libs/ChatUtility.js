const iCrypto = require("./iCrypto.js");
const Err = require("./IError.js");

class ChatUtility{
    /**
     * Standard message referred to string of form [payload] + [sym key cipher] + [const length sym key length encoded]
     * All messages in the system encrypted and decrypted in the described way except for chat messages files and streams.
     * Sym key generated randomly every time
     * @param blob - cipher blob
     * @param lengthSymLengthEncoded number of digits used to encode length of the sym key
     * @param privateKey
     * @returns {}
     */
    static decryptStandardMessage(blob = Err.required(),
                                  privateKey = Err.required(),
                                  lengthSymLengthEncoded = 4, ){

        let symKeyLength = parseInt(blob.substr(blob.length - lengthSymLengthEncoded));

        let symKeyCipher = blob.substring(blob.length - lengthSymLengthEncoded - symKeyLength, blob.length - lengthSymLengthEncoded);
        let payloadCipher = blob.substring(0, blob.length - lengthSymLengthEncoded - symKeyLength);
        let ic = new iCrypto();
        ic.addBlob("blobcip", payloadCipher)
            .addBlob("symkciphex", symKeyCipher)
            .hexToBytes("symkciphex", "symkcip")
            .asym.setKey("privk", privateKey, "private")
            .asym.decrypt("symkcip", "privk", "symk")
            .AESDecrypt("blobcip", "symk", "blob-raw", true, "CBC", "utf8");
        return ic.get("blob-raw");
    }

    static encryptStandardMessage(blob = Err.required(),
                                  publicKey = Err.required(),
                                  lengthSymLengthEncoded = 4,){
        let ic = new iCrypto();
        ic.sym.createKey("symk")
            .addBlob("payload", blob)
            .asym.setKey("pubk", publicKey, "public")
            .sym.encrypt("payload", "symk", "blobcip", true, "CBC", "utf8")
            .asym.encrypt("symk", "pubk", "symcip", "hex")
            .encodeBlobLength("symcip", lengthSymLengthEncoded, "0", "symciplength")
            .merge(["blobcip", "symcip", "symciplength"], "res");
        return ic.get("res");
    }

    static publicKeyEncrypt(blob = Err.required(),
                            publicKey = Err.required()){
        const ic = new iCrypto();
        ic.addBlob("blob", blob)
            .asym.setKey("pubk", publicKey, "public")
            .publicKeyEncrypt("blob", "pubk", "blobcip", "hex");
        return ic.get("blobcip");
    }

    static privateKeyDecrypt(blob, privateKey, encoding = "hex"){
        const ic = new iCrypto();
        ic.addBlob("blobvip", blob)
            .asym.setKey("priv", privateKey, "private")
            .privateKeyDecrypt("blobcip", "priv", "blob", encoding);
        return ic.get("blob");
    }

    static sign(data, privateKey){
        if (typeof data !== "string") throw new Error("Data must be a string");
        let ic = new iCrypto()

        ic.addBlob("body", data)
            .setRSAKey("priv", privateKey, "private")
            .privateKeySign("body", "priv", "sign");
        return ic.get("sign");
    }

    static verify(data, publicKey, sign){
        if (typeof data !== "string") throw new Error("Data must be a string");
        let ic = new iCrypto();
        ic.setRSAKey("pubk", publicKey, "public")
            .addBlob("sign", sign)
            .hexToBytes('sign', "signraw")
            .addBlob("b", data);
        ic.publicKeyVerify("b", "sign", "pubk", "v");
        return ic.get("v");
    }

    static getRandomId(length=16){
        let ic = new iCrypto();
        ic.createNonce("n", Math.round(length / 2))
          .bytesToHex("n", "nhex")
        return ic.get("nhex").substring(0, length);
    }

}

module.exports = ChatUtility;
