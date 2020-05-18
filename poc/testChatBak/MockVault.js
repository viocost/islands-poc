const iCrypto = require("../server/classes/libs/iCrypto");

class Vault{
    constructor(){

    }

    initAdmin(password, adminKey, version = Err.required("Version required!")){
        this.init(password, version);
        this.admin = true;
        this.adminKey = adminKey;

    }


    init(password = Err.required(),
         version = Err.required("Version required")){
        if(!password || password.trim === ""){
            throw new Error("Password required");
        }


        let ic = new iCrypto();
        ic.generateRSAKeyPair("kp")
            .getPublicKeyFingerprint("kp", "pkfp")
        //Create new Vault object
        this.password = password;
        this.topics = {};
        this.privateKey = ic.get("kp").privateKey;
        this.publicKey = ic.get("kp").publicKey;
        this.pkfp = ic.get("pkfp");
        this.version = version;
        this.initialized = true;
    }

    // Encrypts all topics and returns an object of
    // pkfp: cipher encrypted topics
    packTopics(){
        let res = {}
        for(let pkfp of Object.keys(this.topics)){
            let topic = this.topics[pkfp]
            res[pkfp] = this.prepareVaultTopicRecord(
                this.version,
                topic.pkfp,
                topic.privateKey,
                topic.name,
                topic.settings,
                topic.comment
            );
        }
        return res;
    }

    prepareVaultTopicRecord(version = Err.required("Version"),
                            pkfp = Err.required("pkfp"),
                            privateKey = Err.required("Private key"),
                            name = Err.required("Name"),
                            settings,
                            comment){
        let topicBlob = JSON.stringify({
            version: version,
            name:  name,
            key:  privateKey,
            settings: settings,
            comment: comment,
            pkfp: pkfp
        })
        let ic = new iCrypto()
        ic.createNonce("salt", 128)
            .encode("salt", "hex", "salt-hex")
            .createPasswordBasedSymKey("key", this.password, "salt-hex")
            .addBlob("topic", topicBlob)
            .AESEncrypt("topic", "key", "cipher", true, "CBC", "utf8")
            .merge(["salt-hex", "cipher"], "blob")
            .setRSAKey("priv", this.privateKey, "private")
            .privateKeySign("cipher", "priv", "sign")
            .encodeBlobLength("sign", 3, "0", "sign-length")
            .merge(["blob", "sign", "sign-length"], "res")
        return ic.get("res")
    }

    pack(){
         let vaultBlob =  JSON.stringify({
            version: this.version,
            publicKey: this.publicKey,
            privateKey: this.privateKey,
            admin: this.admin,
            adminKey: this.adminKey,
            settings: this.settings
        });

        let ic = new iCrypto();
        ic.createNonce("salt", 128)
            .encode("salt","hex", "salt-hex")
            .createPasswordBasedSymKey("key", this.password, "salt-hex")
            .addBlob("vault", vaultBlob)
            .AESEncrypt("vault", "key", "cip-hex", true, "CBC", "utf8")
            .merge(["salt-hex", "cip-hex"], "res")
            .hash("res", "vault-hash")
            .setRSAKey("asymkey", this.privateKey, "private")
            .privateKeySign("vault-hash", "asymkey", "sign");

        let topics = this.packTopics(this.password)


        //console.log(`Salt: ${ic.get("salt-hex")}`)
        //console.log(`Vault: ${ic.get("cip-hex")}`)
        //Sign encrypted vault with private key
        return {
            vault:  ic.get("res"),
            topics: topics,
            hash : ic.get("vault-hash"),
            sign :  ic.get("sign")
        }


    }

}

module.exports = Vault;
