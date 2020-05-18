// ---------------------------------------------------------------------------------------------------------------------------
// Given a source magnet link and key fingerprint creates manifest.json
const path = require("path");
const fs = require("fs");

let source;
let keyFingerprint;

let usage = `USAGE:
    node createManifest.js -s "<magnet-link-for-the-source.>" -k <gpg key fingerprint>

Options:
    -s Required! Magnet link for the Islands source code
       Double quetes around are required to not confuse the shell

    -k Required! Fingerprint of the gpg key that was used to sign the source

`

process.argv.forEach((arg, i)=>{
    switch (arg){
        case "-s":
            source = process.argv[i+1]
            break;
        case "-k":
            keyFingerprint = process.argv[i+1]
            break;
    }
})

if (!source || !keyFingerprint){
    console.error(usage)
    process.exit(1)
}

let manifest = JSON.stringify({
    source: source,
    keyFingerprint: keyFingerprint
})

fs.writeFileSync("manifest.json", manifest);

console.log("manifest.json created!");
