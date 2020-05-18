import { iCrypto } from "./iCrypto"
import { IError as Err }  from "../../../../common/IError";
import * as CuteSet from "cute-set";


export class ChatUtility{
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
            .addBlob("symkcip", symKeyCipher)
            .asym.setKey("privk", privateKey, "private")
            .privateKeyDecrypt("symkcip", "privk", "symk", "hex")
            .AESDecrypt("blobcip", "symk", "blob-raw", true,  "CBC", "utf8");
        return ic.get("blob-raw");
    }

    static encryptStandardMessage(blob = Err.required(),
                                  publicKey = Err.required(),
                                  lengthSymLengthEncoded = 4,){
        let ic = new iCrypto();
        ic.sym.createKey("symk")
            .addBlob("payload", blob)
            .asym.setKey("pubk", publicKey, "public")
            .AESEncrypt("payload", "symk", "blobcip", true, "CBC", "utf8")
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
        ic.addBlob("blobcip", blob)
            .asym.setKey("priv", privateKey, "private")
            .privateKeyDecrypt("blobcip", "priv", "blob", encoding);
        return ic.get("blob");
    }

    static symKeyEncrypt(blob, key, hexify = true){
        const ic = new iCrypto();
        ic.addBlob("b", blob)
            .sym.setKey("sym", key)
            .AESEncrypt("b", "sym", "cip", hexify, "CBC", "utf8");
        return ic.get("cip")
    }

    static symKeyDecrypt(cip, key, dehexify = true){
        const ic = new iCrypto();
        ic.addBlob("cip", cip)
            .sym.setKey("sym", key)
            .AESDecrypt("cip", "sym", "b", dehexify, "CBC", "utf8");
        return ic.get("b")
    }

    static sign(data, privateKey){
        if (typeof data !== "string") throw new Error("Data must be a string");
        let ic = new iCrypto()

        ic.addBlob("body", data)
            .setRSAKey("priv", privateKey, "private")
            .privateKeySign("body", "priv", "sign");
        return ic.get("sign");
    }

    //data must be string
    // sign must be hexified string
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

    //Given set of keys master and object slave
    //return new object that contains entries of slave object which keys
    // are included in master set
    // and empty entries for those key that exist in master but not in slave
    static syncMap(master = Err.required("master dict"),
                   slave = Err.required("slave dict"),
                   empty = {}){

        let slaveKeys = new CuteSet(Object.keys(slave))
        let masterKeys = new CuteSet(master)
        let keySet = masterKeys.intersection(slaveKeys).union(masterKeys);
        let result = {};
        for (let key of keySet){
            result[key] = slave[key] || empty;
        }
        return result;
    }

    static isOnion(str){
        let pattern = /.*[a-z2-7]{16}\.onion.*/;
        return pattern.test(str);
    }
}
