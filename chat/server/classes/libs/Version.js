const fs = require("fs-extra");
const Logger = require("./Logger");
const path = require('path');

let version;

module.exports.getVersion = ()=>{
    try{
        if(version === undefined){
            version = readCurrentVersion()
        }
        return version
    }catch (err){
        Logger.error("Error obtaining version: " + err)
    }

};

function readCurrentVersion(){
    let pkgJson = path.join(__dirname, "../../../", "package.json")
    return JSON.parse(fs.readFileSync(pkgJson)).version;
}
