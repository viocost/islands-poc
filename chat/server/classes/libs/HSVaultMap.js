const fs = require("fs-extra");
const Logger = require("./Logger");

let filePath;
let filename = "map.json";


module.exports.init = function(path){
    if(path[path.length - 1] !== "/")
        path += "/"

    if (!fs.existsSync(path)){
        fs.mkdirSync(path)
    }
    filePath = path + filename;

    if (!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, "{}")
    }

    Logger.debug("HSVault map initialized with filepath: " + filePath)

};

module.exports.put = function(onion, vaultID, description = "", admin = false){
    assertInit();
    onion = onion.substring(0, 16);
    let map = JSON.parse(fs.readFileSync(filePath, "utf8"));
    map[onion] = createHSRecord(vaultID, onion, description, admin);
    fs.writeFileSync(filePath, JSON.stringify(map));
};

module.exports.get = function(onion){
    assertInit();
    onion = onion.substring(0, 16);
    let map = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return map[onion]
};


module.exports.getVaultId = function (onion){
    assertInit();
    onion = onion.substring(0, 16);
    let map =  JSON.parse(fs.readFileSync(filePath, "utf8"));
    if(map[onion]){
        return map[onion].vaultID
    }
};

module.exports.delOnion = function(onion){
    assertInit();
    onion = onion.substring(0, 16);
    let map = getMap();
    if (!map.hasOwnProperty(onion))
        throw new Error("Onion does not exist");
    delete map[onion];
    saveMap(map)
};

module.exports.setOnionState = function(onion, enabled){
    onion = onion.substring(0, 16);
    let map = getMap();
    if (!map.hasOwnProperty(onion))
        throw new Error("Onion does not exist");
    else if(typeof(enabled) !== "boolean")
        throw new Error("State format is invalid. Expected boolean.");
    map[onion].enabled = enabled;
    saveMap(map);
};

module.exports.setOnionDescription = function(onion, description){
    onion = onion.substring(0, 16);
    let map = getMap();
    if (!map.hasOwnProperty(onion))
        throw new Error("Onion does not exist");
    map[onion].description = description;
    saveMap(map);
};

function getMap(){
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

module.exports.getMapAsString = function (){
    return fs.readFileSync(filePath, "utf8");
};

function saveMap(map){
    fs.writeFileSync( filePath, JSON.stringify(map));
}

function assertInit(){
    if(!filePath){
        throw new Error("Hidden Service to vault map has not been initialized");
    }

    if(!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, "{}")
    }
}


function isAdmin(onion){
    onion = onion.substring(0, 16);
    let map = getMap();
    if(!map.hasOwnProperty(onion)){
        return false;
    }
    return map[onion].admin;

}


function  createHSRecord(vaultID, onion, description = "", admin = false, enabled = true ){
        return {
            vaultID: vaultID,
            onion: onion,
            admin: admin,
            enabled: enabled
        }
    }

module.exports.getMap = getMap;
module.exports.isAdmin = isAdmin;
