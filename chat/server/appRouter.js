const { Router } = require("express");
const router = Router();
const VaultManager = require("./classes/libs/VaultManager");
const Logger = require("./classes/libs/Logger");
const AdminKey = require("./classes/libs/AdminKey");
const HSMap = require("./classes/libs/HSVaultMap");
const { isSecured } = require("./classes/AdminServer");


let vaultManager;

module.exports.init = function(config) {
    vaultManager = new VaultManager(config);
}

router.get('/', (req, res)=>{
    console.log(`GET chat. Version ${global.VERSION}`);
    res.render("chat", {
        title:"Islands chat",
        version: global.VERSION,
        registration: isVaultAwaitingRegistration(req.headers["host"]),

    });
});


// Posting to root path interpreted as a login attempt
// processing login
router.post("/", (req, res)=>{
    try{
        let id = getVaultId(req.headers["host"]);
        if(!id){
            res.set("Content-Type", "application/json")
            res.status(401).send("Vault login error: vault not found");
        } else {
            let vault = vaultManager.getVault(id);
            res.set("Content-Type", "application/json")
               .status(200).send({"vault": vault, "vaultId": id, "version": global.VERSION})
        }
    }catch(err){
        Logger.warn(err.message, {stack: err.stack, cat: "login"});
        res.set("Content-Type", "application/json")
        res.status(400).send("Vault login error.");
    }
});

router.post("/register", (req, res)=>{
    console.log("GUEST REGISTRATION!");
    if(!isVaultAwaitingRegistration(req.headers.host)) {
        res.status(401).send("Error: vault is not awaiting registration.");
        return;
    }
    guestVaultRegistration(req, res);
})

function guestVaultRegistration(req, res){
    try{
        let host = req.headers["host"];
        let vaultId = getVaultId(host);
        let vaultData = req.body;
        console.log(`vault hash is : ${vaultData.vaultHash}`);
        vaultManager.completeRegistration(
            vaultData.vault,
            vaultData.vaultHash,
            vaultData.vaultSign,
            vaultData.vaultPublicKey,
            vaultId
            );
        res.set("Content-Type", "application/json");
        res.status(200).send(req.body);
    }catch(err){
        Logger.debug(err)
        res.status(400).send({error: err})
    }
}

function isVaultAwaitingRegistration(host){
    //host is either ip address or onion
    console.log(`HOST IS ${host}`)
    if (isOnion(host)){
        let vaultId = HSMap.getVaultId(host)
        return vaultId ? vaultManager.isRegistrationPending(vaultId) : false;
    }else if (/^((?:[0-9]{1,3}\.){3}[0-9]{1,3}|localhost)(\:[0-9]{1,5})?$/.test(host)){
        return !isSecured()
    } else {
        Logger.warn(`Unrecognized host: ${host}`, { cat: "chat" });
        return false;
    }
}

//Given a host returns vault ID associated with it
//IF host is not an onion address - id of admin vault returned
//If no vault matches onion address - undefined returned
function getVaultId (host){
    if (!isOnion(host)) {
        return AdminKey.getPkfp();
    } else {
        return HSMap.getVaultId(extractOnion(host));
    }
}


function isOnion(host){
    let pattern = /.*[a-z2-7]{16}\.onion.*/;
    return pattern.test(host);
}

function extractOnion(host){
    return host.match(/[a-z2-7]{16}\.onion/)[0];
}

module.exports.router = router;
