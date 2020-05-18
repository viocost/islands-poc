import { iCrypto } from "./iCrypto"



/**
 * Implements files attachments functionality
 * Constructor accepts a file element
 */
export class AttachmentInfo{
    constructor(file, onion, pkfp, metaID, privKey, messageID, hashEncrypted, hashUnencrypted, hashAlgo = "sha256"){
        let self = this;
        self.name = file.name;
        self.size = file.size;
        self.type = file.type;
        self.lastModified = file.lastModified;
        self.pkfp = pkfp;
        self.metaID = metaID;
        self.hashAlgorithm = hashAlgo;
        self.messageID = messageID;
        self.hashEncrypted = hashEncrypted;
        self.hashUnencrypted = hashUnencrypted;
        self.link = self.buildLink(onion, pkfp, self.hashUnencrypted);
        self.signHashes(privKey);
    }

    get(){
        let self = this;
        return {
            name: self.name,
            size: self.size,
            type: self.type,
            lastModified: self.lastModified,
            pkfp: self.pkfp,
            hashEncrypted: self.hashEncrypted,
            hashUnencrypted: self.hashUnencrypted,
            signEncrypted: self.signEncrypted,
            signUnencrypted: self.signUnencrypted,
            metaID: self.metaID,
            messageID: self.messageID,
            link: self.link,
            hashAlgorithm: self.hashAlgorithm
        }
    }

    getLink(){
        return this.link;
    }

    static verifyFileInfo(info){
        let required = ["name", "size", "pkfp", "hashUnencrypted", "hashEncrypted", "signUnencrypted", "signEncrypted", "link",  "metaID", "messageID", "hashAlgorithm"];
        for(let i of required){
            if (!info.hasOwnProperty(i)){
                throw new Error("Attachment verifyFileInfo: Missing required property: " + i);
            }
        }
    }

    static parseLink(link){
        const ic = new iCrypto();
        ic.addBlob("l", link)
            .base64Decode("l", "lres");
        const elements = ic.get("lres").split("/");
        return{
            residence: elements[0],
            pkfp: elements[1],
            name: elements[2]
        }
    }



    buildLink(onion, pkfp, hash){
        if(!onion || !pkfp || !hash){
            throw new Error("Attachment buildLink: missing required parameters");
        }
        const rawLink = onion + "/" + pkfp + "/" + hash;
        const ic = new iCrypto();
        ic.addBlob("l", rawLink)
            .base64Encode("l", "l64");
        return ic.get("l64");
    }

    signHashes(privKey){
        if(!privKey){
            throw new Error("Attachment signAttachmentHash: privKey is undefined");
        }
        let self = this;
        let ic = new iCrypto();
        ic.addBlob("hu", self.hashUnencrypted)
            .addBlob("he", self.hashEncrypted)
            .asym.setKey("pk", privKey, "private")
            .asym.sign("hu", "pk", "sign_u")
            .asym.sign("he", "pk", "sign_e");
        self.signUnencrypted = ic.get("sign_u");
        self.signEncrypted = ic.get("sign_e");
    }
}

AttachmentInfo.properties = ["name", "size", "type", "lastModified", "hashUnencrypted", "signUnencrypted", "hashEncrytped", "signEncrypted","link", "metaID", "messageID", "hashAlgorithm"];


