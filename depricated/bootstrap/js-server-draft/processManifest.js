// ---------------------------------------------------------------------------------------------------------------------------
// This script fetches manifest file from torrent,
// fetches source code specified in manifes
// validates and installs it,
// and exitst with 0 if all is successful

//const Transmission = require("transmission");
const path = require("path");
const fs = require("fs");
const QBT = require("qbittorrent-api");
const PMT = require("parse-magnet-uri");
const parseMagnet = PMT.parseMagnet

const ERROR = {
    NO_MANIFEST_LINK: 1,
    MANIFEST_DOWNLOAD_TIMEOUT: 2,
    SOURCE_DOWNLOAD_TIMEOUT: 3,
    SOURCE_INVALID: 4,
    PUBLIC_KEY_NOT_FOUND: 5,
    TORRENT_DAEMON_ERROR: 6,
    DISK_ERROR: 7,
    MANIFEST_ERROR: 8,
    UNKNOWN_ERROR: 117
}




process.on("SIGINT", ()=>{
    console.log("Interrupted. Exiting");
    exit = true;
    process.exit();
})

if (process.argv.length < 3){
    console.log("Manifest argument is not provided! exititin...");
    process.exit(ERROR.NO_MANIFEST_LINK)
}

let qbt = QBT.connect("http://localhost:8080", "admin", "adminadmin")

console.log("Connection request sent..");

qbt.version((err, data)=>{
    if (err){
        console.error(err)
        process.exit(ERROR.TORRENT_DAEMON_ERROR)
    }
    console.log(data);
})

let manifestId;
let manifestPath;
let sourceFilePath;
let manifestDownloadStart;
let sourceDownloadStart;
let exiting = false

let manifestMagnet = fs.readFileSync(process.argv[2], "utf8");
console.log(`Loaded magnet: ${manifestMagnet}`);


function addManifest(){
    let manifestHash = parseMagnet(manifestMagnet).infoHash;

    qbt.add(magnet, (err, result)=>{
        if (err){
            console.log(err);
            process.exit(ERROR.TORRENT_DAEMON_ERROR)
        } else if (exiting){
            console.log("Exiting detected.");
            return;
        }

        waitManifest(manifestHash);
    })
}




function waitManifest(manifestIHash){
    console.log("Waiting for manifest");
    qbt.active((err, res=[])=>{
        if (err){
            console.log(err);
            process.exit(TORRENT_DAEMON_ERROR);
        }

        if(exiting){
            return;
        }

        let manifest = res.filter((torrent)=>{ return torrent.hash.toLowerCase() === manifestHash.toLowerCase()})[0]

        if (!manifest){
            console.log("Manifets has not been added");
            process.exit(TORRENT_DAEMON_ERROR);
        }

        if (manifest.progress === 1){
            //Torrent is finished
            processManifest(manifest)
        } else {
            console.log("Manifest is not ready yet. Waitig.");
            setTimeout(waitManifest, 4000)
        }


    })

}


function processManifest(manifestTorrent){
    if (exiting) return;
    console.log("Processing manifest");
}


// qbt.get((err, arg)=>{
//     if(err){
//         console.log(err);
//         process.exit()
//     }else{
//         for (let t of arg.torrents){
//             console.log(t);
//         }
//     }

// })

addManifest();
