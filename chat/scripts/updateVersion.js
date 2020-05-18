const fs = require("fs");
let path = "../package.json";

process.argv.forEach((val, index, array)=> {
    if (val === "-p") {
        path = process.argv[index + 1];
    }
});


function padWithZeroes(requiredLength, value){
    let res = ("0".repeat(requiredLength)) + String(value).trim()
    return res.substr(res.length - requiredLength)
}


try{
    let packageFile = JSON.parse(fs.readFileSync(path).toString())
    let versionString = packageFile.version;
    let lastDotIndex = versionString.lastIndexOf(".");
    let autoincrementPart = versionString.substr(lastDotIndex+1)
    let curVersion =  parseInt(autoincrementPart);
    let newVersion = versionString.substring(0, lastDotIndex +1) + padWithZeroes(autoincrementPart.length, (curVersion += 1))
    packageFile.version = newVersion;
    fs.writeFileSync(path, JSON.stringify(packageFile, null, 2));
    console.log("Version number updated successfully!")
}catch(err){
    console.log("Error updating version: " + err)
}



