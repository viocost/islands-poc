import { AttachmentInfo } from "./AttachmentInfo";
import { iCrypto } from "./iCrypto"

/**
 * Represents chat message
 * Signature hashes only header + body of the message
 *
 * Recipient:
 * */
export class ChatMessage{
    constructor(blob){
        if(typeof(blob) === "string"){
            blob = JSON.parse(blob);
        }

        this.signature = blob ?  blob.signature : "";
        this.header = blob ? blob.header : {
            id : this.generateNewID(),
            timestamp: new Date(),
            metadataID :"",
            author: "",
            nickname: "", //AUTHOR PKFP
            recipient: "ALL", //RCIPIENT PKFP
        };
        this.body = blob ? blob.body : "";
        this.attachments = blob ? blob.attachments : undefined;
    }

    /**
     * encrypts and replaces the body of the message with its cipher
     * @param key Should be SYM AES key in form of a string
     */
    encryptMessage(key){
        let self = this;
        console.log(`Body is: ${self.body} `);
        let ic = new iCrypto();
        ic.setSYMKey("k", key)
            .addBlob("body", self.body)
            .AESEncrypt("body", "k", "bodycip", true, "CBC", 'utf8');
        if (self.attachments){
            ic.addBlob("attachments", JSON.stringify(self.attachments))
                .AESEncrypt("attachments", "k", "attachmentscip", true, undefined, "utf8")
            self.attachments = ic.get("attachmentscip")
        }

        if (self.header.nickname){
            ic.addBlob("nname", self.header.nickname)
                .AESEncrypt("nname", "k", "nnamecip", true,  "CBC", "utf8");
            self.header.nickname = ic.get("nnamecip")
        }

        self.body = ic.get("bodycip")
    }


    encryptPrivateMessage(keys){
        let self = this;
        let ic = new iCrypto();
        ic.sym.createKey("sym")
            .addBlob("body", self.body)
            .AESEncrypt("body", "sym", "bodycip", true, "CBC", 'utf8');
        if (self.header.nickname){
            ic.addBlob("nname", self.header.nickname)
                .AESEncrypt("nname", "sym", "nnamecip", true, 'CBC', "utf8");
            self.header.nickname = ic.get("nnamecip")
        }
        self.body = ic.get("bodycip");
        self.header.keys = {};
        self.header.private = true;
        for(let key of keys){
            let icn = new iCrypto();
            icn.asym.setKey("pubk", key, "public")
                .addBlob("sym", ic.get("sym"))
                .asym.encrypt("sym", "pubk", "symcip", "hex")
                .getPublicKeyFingerprint("pubk", "pkfp");
            self.header.keys[icn.get("pkfp")] = icn.get("symcip")
        }
    }

    decryptServiceRecord(privateKey, ){
        let symLenghtEncoded = 4
        let blob = this.body;

        let symKeyLenght = parseInt(blob.substr(blob.length - symLenghtEncoded));

        let symKeyCipher = blob.substring(blob.length - symLenghtEncoded - symKeyLenght, blob.length - symLenghtEncoded);
        let payloadCipher = blob.substring(0, blob.length - symLenghtEncoded - symKeyLenght);
        let ic = new iCrypto();
        ic.addBlob("blobcip", payloadCipher)
            .addBlob("symkciphex", symKeyCipher)
            .hexToBytes("symkciphex", "symkcip")
            .asym.setKey("privk", privateKey, "private")
            .asym.decrypt("symkcip", "privk", "symk")
            .AESDecrypt("blobcip", "symk", "blob-raw", true, "CBC", "utf8");
        this.body = ic.get("blob-raw");
    }

    decryptPrivateMessage(privateKey){
        try{
            let ic = new iCrypto();
            ic.asym.setKey("priv", privateKey, "private")
                .publicFromPrivate("priv", "pub")
                .getPublicKeyFingerprint("pub", "pkfp")
                .addBlob("symcip", this.header.keys[ic.get("pkfp")])
                .asym.decrypt("symcip", "priv", "sym", "hex")
                .addBlob("bodycip", this.body)
                .sym.decrypt("bodycip", "sym", "body", true,  "CBC", "utf8");
            this.body = ic.get("body");

            if(this.header.nickname){
                ic.addBlob("nnamecip", this.header.nickname)
                    .AESDecrypt("nnamecip", "sym", "nname", true,  "CBC", "utf8");
                this.header.nickname= ic.get("nname");
            }

        }catch(err){
            console.log("Error decrypting private message: " + err);
        }
    }


    /**
     * Decrypts body and replaces the cipher with raw text
     * @param key
     */
    decryptMessage(key){
        try{
            let ic = new iCrypto();
            ic.sym.setKey("k", key)
                .addBlob("bodycip", this.body)
                .sym.decrypt("bodycip", "k", "body", true);
            this.body = ic.get("body")
            if (this.attachments){
                ic.addBlob("attachmentscip", this.attachments)
                    .AESDecrypt("attachmentscip", "k", "attachments", true, "CBC", "utf8");
                this.attachments = JSON.parse(ic.get("attachments"))
            }
            if(this.header.nickname){
                ic.addBlob("nnamecip", this.header.nickname)
                    .AESDecrypt("nnamecip", "k", "nname", true,  "CBC", "utf8");
                this.header.nickname= ic.get("nname");
            }
        }catch(err){
            console.log("Error decrypting message: " + err);
        }
    }

    /**
     * Adds attachment metadata to the message
     * @param {Attachment} attachment
     */
    addAttachmentInfo(attachment){
        let self = this;
        if(!self.attachments){
            self.attachments = []
        }

        AttachmentInfo.verifyFileInfo(attachment);
        self.attachments.push(attachment);
    }


    sign(privateKey){
        let ic = new iCrypto();
        let requestString = JSON.stringify(this.header) + JSON.stringify(this.body);
        if (this.attachments){
            requestString += JSON.stringify(this.attachments)
        }
        ic.addBlob("body", requestString)
            .setRSAKey("priv", privateKey, "private")
            .privateKeySign("body", "priv", "sign");
        this.signature = ic.get("sign");
    }

    verify(publicKey){
        let ic = new iCrypto();
        let requestString = JSON.stringify(this.header) + JSON.stringify(this.body);
        if (this.attachments){
            requestString += JSON.stringify(this.attachments)
        }
        ic.setRSAKey("pubk", publicKey, "public")
            .addBlob("sign", this.signature)
            .addBlob("b", requestString)
            .publicKeyVerify("b", "sign", "pubk", "v");
        return ic.get("v");
    }

    getNonce(size){
        let ic = new iCrypto;
        ic.createNonce("n", size ? parseInt(size): 8 )
            .bytesToHex("n", "nh");
        return ic.get("nh");
    }

    generateNewID(){
        return this.getNonce(8);
    }



    toBlob(){
        return JSON.stringify(this);
    }

}


