const Logger = require("./Logger.js");
const fs = require("fs-extra");
const path = require("path")
const RandExp = require("randexp");
const iCrypto = require("./iCrypto");
const AdminKey = require("./AdminKey");



/**FILENAMES*/
const PENDING = "pending.signature";
const VAULT = "vault";
const PUBLICKEY = "publicKey";


class VaultManager{
    constructor(config){
        if (!config.vaultsPath){
            throw new Error("Init error: Vaults path is not specified!");
        }
        this.vaultsPath = config.vaultsPath;

        if(!fs.existsSync(this.vaultsPath)){
            Logger.debug("Vaults directory doesn't exist. Creating...");
            fs.mkdirSync(this.vaultsPath);
            Logger.debug("Vaults directory created!");
        }

        this.vaultIdLength = config.vaultIdLength || 64;
    }

    updateVaultFormat(id, vaultBlob, topics, publicKey, hash){
        Logger.info("Updating vault format", {cat: "vault"});
        this._backupVault(id)
        this._writeVault(id, vaultBlob, publicKey, hash)
        for(let pkfp of Object.keys(topics)){
            this.saveTopic(id, pkfp, topics[pkfp])
        }
    }


    updateVault(vaultBlob, id, hash, previousHash, signature, publicKey = null){

        if(!publicKey){
            publicKey = this.getVaultPublicKey(id);
        }

        if(!this.isOwnerVerified(vaultBlob, hash, signature, publicKey)){
            throw new Error("Owner's signature is invalid");
        }

        if(this.isRegistrationPending(id)){
            throw new Error("The vault registration is pending. Updates are disabled");
        }


        this._updateVault(id, vaultBlob, publicKey);
        Logger.debug("Vault successfully updated!");
    }

    isOwnerVerified(vaultBlob, hash,  signature, publicKey){
        let ic = new iCrypto();
        ic.addBlob("vaulthex", vaultBlob)
            .addBlob("hash", hash)
            .addBlob("sign", signature)
            .setRSAKey("pubkey", publicKey, "public")
            .publicKeyVerify("hash", "sign", "pubkey", "verified");

        return ic.get("verified")
    }

    saveNewVault(vaultBlob, hash, signature, publicKey, id){
        let ic = new iCrypto();
        ic.addBlob("vaulthex", vaultBlob)
            .addBlob("hash", hash)
            .hash("vaulthex", "calc-hash")
            .addBlob("sign", signature)
            .setRSAKey("pubkey", publicKey, "public")
            .publicKeyVerify("hash", "sign", "pubkey", "verified");
        if(!ic.get("verified")){
            throw new Error("Vault signature is not valid");
        }

        if(ic.get("calc-hash") !== hash){

            throw new Error(`Vault hash is invalid. Passed: ${hash}, calculated: ${ic.get("calc-hash")}`);
        }

        Logger.debug("Signature is valid");

        if (!id){
            do{
                id = this.generateID();
            }while (this.isVaultExist(id));
        } else if (this.isVaultExist(id)){
            throw new Error("Vault already exists");
        }
        this._writeVault(id, vaultBlob, publicKey, hash);
        return id;
    }

    async saveTopic(vaultId, topicPkfp, topicBlob){
        //verify
        Logger.debug(`Save topic request received: vault id: ${vaultId}, toipcPkfp: ${topicPkfp}, blob lengt: ${topicBlob.length}`,
                     {cat: "topic_create"});
        let publicKey = this.getVaultPublicKey(vaultId);

        let ic = new iCrypto();
        let signLength = parseInt(topicBlob.substr(topicBlob.length - 3))
        let signature = topicBlob.substring(topicBlob.length - signLength - 3, topicBlob.length - 3);
        let topicCipher = topicBlob.substring(256, topicBlob.length - signLength - 3);
        ic.setRSAKey("pub", publicKey, "public")
            .addBlob("cipher", topicCipher)
            .addBlob("sign", signature)
            .publicKeyVerify("cipher", "sign", "pub", "verified")
        if(!ic.get("verified")) throw new Error("Topic signature is invalid!")

        // write blob
        Logger.debug("Topic update verified", {cat: "topic_create"})
        fs.writeFileSync(path.join(this.vaultsPath, vaultId, "topics", topicPkfp), topicBlob);
        Logger.debug("Topic record saved", {cat: "topic_create"})
    }

    async deleteTopic(vaultId, topicPkfp, nonce, sign){
        Logger.debug(`Deleting toipc record pkfp: ${topicPkfp}, vault: ${vaultId}`, {cat: "topic_delete"})
        let publicKey = this.getVaultPublicKey(vaultId)
        let ic = new iCrypto()
        ic.addBlob("sign", sign)
          .addBlob("nonce", nonce)
          .setRSAKey("pub", publicKey, "public")
          .publicKeyVerify("nonce", "sign", "pub", "res")
        if(!ic.get("res")) throw new Error("Error deleting topic record: signature verification failed")

        let recordPath = path.join(this.getTopicsPath(vaultId), topicPkfp);
        fs.unlinkSync(recordPath);
        Logger.debug("Topic record is deleted", {cat: "topic_delete"})
    }



    completeRegistration(vaultBlob, hash, signature, publicKey, id){
        let ic = new iCrypto();
        ic.addBlob("vault64", vaultBlob)
            .addBlob("hash", hash)
            .hash("vault64", "calc-hash")
            .addBlob("sign", signature)
            .setRSAKey("pubkey", publicKey, "public")
            .hexToBytes("vault64", "vault")
            .publicKeyVerify("hash", "sign", "pubkey", "verified");
        if(!ic.get("verified")){
            throw new Error("Vault signature is not valid");
        }
        if (ic.get("calc-hash") !== hash){
            throw new Error("Vault hash is invalid")
        }

        Logger.debug("Signature is valid");
        if(!this.isRegistrationActive(id)){
            throw new Error("Registration is not active for: " + id)
        }

        this._writeVault(id, vaultBlob, publicKey, hash);
        this._consumeRegistrationToken(id)
    }

    getVault(id){
        //Get vault
        if(!this.isVaultExist(id)){
            throw new Error("Vault not found");
        }
        let vaultPath = this.getVaultPath(id);
        let topicsPath = this.getTopicsPath(id);
        if (!fs.existsSync(topicsPath)){
            console.log("Topics path does not exist. Probably vault is in v1 format. Creating...")
            fs.mkdirSync(topicsPath)
        }
        let topicsFiles = fs.readdirSync(topicsPath)
        let res = {}
        res.vault = fs.readFileSync(vaultPath, 'utf8');
        res.topics = {}
        for (let topic of topicsFiles){
            res.topics[topic] = fs.readFileSync(path.join(topicsPath,  topic), "utf8")
        }
        return res
    }

    isRegistrationPending(vaultID){
        Logger.debug("Registration pending called but not implemented!");
        return  fs.existsSync(path.join(this.vaultsPath,  vaultID)) &&
            !fs.existsSync(path.join(this.vaultsPath, vaultID,  VAULT)) &&
            !fs.existsSync(path.join(this.vaultsPath, vaultID,  PUBLICKEY)) &&
            fs.existsSync(path.join(this.vaultsPath,  vaultID,  PENDING))
    }

    isRegistrationActive(vaultID){
        let adminPublicKey = AdminKey.get();
        if(!this.isRegistrationPending(vaultID)){
            return false
        }

        let signData =  fs.readFileSync(path.join(this.vaultsPath, vaultID, PENDING), "utf8");
        let ic = new iCrypto();
        ic.addBlob("sign", signData)
            .addBlob("idhex", vaultID)
            .hexToBytes("idhex", "id")
            .setRSAKey("pub", adminPublicKey, "public")
            .publicKeyVerify("id", "sign", "pub", "res");
        return ic.get("res")
    }


    _consumeRegistrationToken(vaultID){
        fs.unlinkSync(path.join(this.vaultsPath, vaultID, PENDING));
    }

    createGuestVault(vaultID, signature){
        fs.mkdirSync(path.join(this.vaultsPath,  vaultID));
        fs.writeFileSync(path.join(this.vaultsPath, vaultID, PENDING), signature)
    }

    logUnauthorizedWriteAttempt(data){
        Logger.warn("Unauthorized vault write attempt!", data)
    }

    getVaultDirPath(id){
        return path.join(this.vaultsPath, id);
    }

    getVaultPath(id){
        return path.join(this.vaultsPath, id, "vault");
    }

    getTopicsPath(id){
        return path.join(this.vaultsPath, id, "topics");
    }

    async deleteVault(id){
        let _path = path.join(this.vaultsPath, id)
        if(fs.existsSync(_path))
            await fs.remove(_path);
    }

    isVaultExist(id){
        let vaultDir = path.join(this.vaultsPath, id);
        let vaultFile = path.join(this.vaultsPath, id, "vault");
        let pubKey = path.join(this.vaultsPath, id, "publicKey");
        console.log(`dir: ${vaultDir}, file: ${vaultFile}, key: ${pubKey}`);

        return (fs.existsSync(vaultDir) &&
                fs.existsSync(vaultFile) &&
                fs.existsSync(pubKey));
    }

    _writeVault(id, blob, publicKey, hash){
        let vaultPath = path.join(this.vaultsPath, id);
        if(!fs.existsSync(vaultPath)){
            fs.mkdirSync(vaultPath);
        }
        if (!fs.existsSync(path.join(vaultPath, "topics"))){
            fs.mkdirSync(path.join(vaultPath, "topics"));
        }
        fs.writeFileSync(path.join(vaultPath, "vault"), blob);
        fs.writeFileSync(path.join(vaultPath, "publicKey"), publicKey);
        fs.writeFileSync(path.join(vaultPath, "hash"), hash);
    }

    _backupVault(id){
        let vaultPath = path.join(this.vaultsPath, id);
        let bakPath = path.join(this.vaultsPath, `${id}_BAK`);

        if(!fs.existsSync(vaultPath)){
            return;
        }

        if(!fs.existsSync(bakPath)){
            fs.mkdirSync(bakPath)
        }
        fs.copySync(vaultPath, bakPath)
    }

    _updateVault(id, blob){
        let vaultPath = path.join(this.vaultsPath, id);
        fs.writeFileSync(path.join(vaultPath, "vault"), blob);
    }

    getVaultPublicKey(id){
        if(!this.isVaultExist(id)){
            throw new Error("Vault not found");
        }

        return fs.readFileSync(path.join(this.vaultsPath, id, "publicKey"), 'utf8');
    }


    generateID(){
        return new RandExp(new RegExp("[a-f0-9]{" + this.vaultIdLength + "}")).gen();
    }


    // ---------------------------------------------------------------------------------------------------------------------------
    // GARBAGE

    ///////////////////////////////////////////////////////////////////////////////
    // deleteTopicBAK(vaultBlob, vaultId, pkfp, signature, publicKey = null){    //
    //     if(!publicKey){                                                       //
    //         publicKey = this.getVaultPublicKey(vaultId);                      //
    //     }                                                                     //
    //     if(!this.isOwnerVerified(vaultBlob, signature, publicKey)){           //
    //         throw("Owner's signature is invalid");                            //
    //     }                                                                     //
    //     if(this.isRegistrationPending(vaultId)){                              //
    //         throw("The vault registration is pending. Updates are disabled"); //
    //     }                                                                     //
    //                                                                           //
    //     //updating vault                                                      //
    //     this._updateVault(vaultId, vaultBlob, publicKey);                     //
    //                                                                           //
    //                                                                           //
    // }                                                                         //
    ///////////////////////////////////////////////////////////////////////////////


}

module.exports = VaultManager;

   
/**
 *  dir-id
 *    vault
 *    publicKey
 *
 */
