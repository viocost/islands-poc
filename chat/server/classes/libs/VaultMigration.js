const fs = require("fs-extra");
const tmp = require("tmp");
const { zip } = require("zip-a-folder");
const  extract  = require("extract-zip")
const path = require("path");
const  assert  = require("./assert");
const iCrypto = require("./iCrypto");

async function exportVault(vaultId, historyManager, vaultManager){
    //Check if vault exist

    console.log("Reading data")
    console.log(`Vault id: ${vaultId}`);
    let vaultPath = vaultManager.getVaultDirPath(vaultId);
    if (!fs.existsSync(vaultPath)){
        throw new Error(`Vault export error: vault ${vaultId} does not exist`)
    }
    let topicsPath = vaultManager.getTopicsPath(vaultId);
    let topicIds;

    //create temp dir
    // create vault content dir
    // create topics content dir
    console.log(`Vault path: ${vaultPath}\n
                topics path ${topicsPath}`);

    console.log("Creating temp dirs");

    let tDir = tmp.dirSync();
    console.log(`TEMP DIR CREATED: ${tDir.name}`);
    let vaultRoot = path.join(tDir.name, "vault");
    let vaultsDir = path.join(vaultRoot, "vaults");
    let topicsDir = path.join(vaultRoot, "history");
    let vaultDir = path.join(vaultsDir, vaultId);



    fs.mkdirSync(vaultRoot)
    fs.mkdirSync(vaultsDir)
    fs.mkdirSync(vaultDir)
    fs.mkdirSync(topicsDir)

    //copy vault
    //

    console.log("Copying data");
    fs.copySync(vaultPath, vaultDir);


    let historyPath = historyManager.getHistoryDirectory();


    if(!fs.existsSync(topicsPath)){
        //version 1.1.1 and lower

        topicsIds = fs.readdirSync(historyPath).filter(id =>{
            return fs.existsSync(path.join(historyPath, id, "history_store"))
        });
    } else{
        //new version
        toipcIds = fs.readdirSync(topicsPath)
    }

    //for each topic
    for (let pkfp of topicsIds){
        let tPath = path.join(historyPath, pkfp);
        let tdPath = path.join(topicsDir, pkfp);
        fs.mkdirSync(tdPath)
        console.log(`Copying topic: ${pkfp}`);

        //   copy topic
        fs.copySync(tPath, tdPath);

        //   if user is owner and topic authority is present
        let taPkfp = await getTAPkfpIfOwner(historyManager, pkfp)
        if(taPkfp){

            //      copy it also
            console.log(`User is owner of ${pkfp}, copying topic authority...`);
            let taPath = path.join(historyPath, taPkfp);

            let tadPath = path.join(topicsDir, taPkfp);
            fs.copySync(taPath, tadPath);
        }

    }

    let zipDest = path.join(tDir.name, "vault.zip")

    await zip(vaultRoot, zipDest)
    fs.removeSync(vaultRoot);
    return zipDest;


}

async function importVault(pathToVaultZip, dataPath, importAsAdmin = false, passwd = null){
    //Check stuff
   
    assert(fs.existsSync(pathToVaultZip), `Zip archive ${pathToVaultZip} does not exist`)
    assert(fs.existsSync(dataPath), `Data path ${dataPath} does not exist`)
    assert((importAsAdmin && passwd) || !importAsAdmin, "Vault password is required")
    //unzip
    let tDir = tmp.dirSync()
    await extract(pathToVaultZip, {dir: tDir.name })


    //If admin = generate keys
    if (importAsAdmin){
        let vaultsDir = path.join(tDir.name, "vaults")
        let vaultId = fs.readdirSync(vaultsDir)[0]

        assert(vaultId, "Vault is not present in the archive")
        let vaultPath = path.join(vaultsDir, vaultId, "vault")
        let vaultHashPath = path.join(vaultsDir, vaultId, "hash")
        assert(fs.existsSync(vaultPath), "Vault is not present in the archive")

        console.log("Generating admin key and updating vault...")

        let vaultEnc = fs.readFileSync(vaultPath, "utf8");
        let ic = new iCrypto();

        ic.addBlob("s16", vaultEnc.substring(0, 256))
            .addBlob("v_cip", vaultEnc.substr(256))
            .hexToBytes("s16", "salt")
            .createPasswordBasedSymKey("sym", passwd, "s16")
            .AESDecrypt("v_cip", "sym", "vault_raw", true)
            .generateRSAKeyPair("kp")
            .getPublicKeyFingerprint("kp", "new_pkfp")

        let newVaultId = ic.get("new_pkfp")

        let adminPublicKey = ic.get('kp').publicKey;

        let data = JSON.parse(ic.get("vault_raw"));

        data.adminKey = ic.get("kp").privateKey;
        data.admin = true;
        let privKey = data.privateKey;

        ic = new iCrypto();
        ic.createNonce("salt", 128)
            .encode("salt","hex", "salt-hex")
            .createPasswordBasedSymKey("key", passwd, "salt-hex")
            .addBlob("vault", JSON.stringify(data))
            .AESEncrypt("vault", "key", "cip-hex", true, "CBC", "utf8")
            .merge(["salt-hex", "cip-hex"], "res")
            .hash("res", "vault-hash")
            .setRSAKey("asymkey", privKey, "private")
            .privateKeySign("vault-hash", "asymkey", "sign");

        console.log("Crypto is completed. Replacing files...");

        fs.writeFileSync(vaultPath, ic.get("res"))
        fs.writeFileSync(vaultHashPath, ic.get("vault-hash"))

        let keysDirPath = path.join(tDir.name, "keys");
        if(!fs.existsSync(keysDirPath)){
            fs.mkdirSync(keysDirPath)
        }
        let adminKeyPath = path.join(keysDirPath, vaultId)

        fs.writeFileSync(adminKeyPath, adminPublicKey);

        //renaming for new id

        let newAdminKeyPath = path.join(keysDirPath, newVaultId)
        let newVaultPath = path.join(vaultsDir, newVaultId)
        fs.renameSync(adminKeyPath, newAdminKeyPath)
        fs.renameSync(path.join(vaultsDir, vaultId), newVaultPath)
    }


    //finally copying stuff to final destination
    fs.copySync(tDir.name, dataPath)

    console.log("All set!");
}

async function getTAPkfpIfOwner(historyManager, pkfp){
    console.log(`Getting topic metadata for ${pkfp}`);
    let metadata = JSON.parse(await historyManager.getLastMetadata(pkfp));
    return metadata.body.owner === pkfp ? metadata.body.topicAuthority.pkfp : null;
}

module.exports.exportVault = exportVault;
module.exports.importVault = importVault;
