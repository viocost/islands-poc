const fs = require("fs-extra");
const iCrypto = require("./iCrypto");
const Logger = require("./Logger");
const path = require("path")

let adminKeyPath;
let cachePkfp;
let cacheKey;

module.exports.init = (config)=>{
    Logger.debug("Initializing admin key with path " + config.adminKeyPath);
    adminKeyPath = config.adminKeyPath;
    if(!fs.existsSync(adminKeyPath)){
        fs.mkdirSync(adminKeyPath)
    }
};

module.exports.get = ()=>{
    ensureInitialized();

    let pubKey = fs.readFileSync(path.join(adminKeyPath , fs.readdirSync(adminKeyPath)[0]), "utf8");
    if (!pubKey){
        throw new Error("Error: public key not found.");
    }

    return pubKey
};

module.exports.getPkfp = ()=>{
    ensureInitialized();
    let pubKey = fs.readFileSync(path.join(adminKeyPath , fs.readdirSync(adminKeyPath)[0]), "utf8");

    let ic = new iCrypto();
    ic.setRSAKey("pub", pubKey, "public")
        .getPublicKeyFingerprint("pub", "pkfp");
    return ic.get("pkfp");
};

function ensureInitialized(){
    if (!adminKeyPath) throw new Error("Admin Key module has not been initialized");
}
