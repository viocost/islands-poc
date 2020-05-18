const path = require("path");
const fs = require("fs");
const QBT = require("qbittorrent-api");
const parseMagnet = require("parse-magnet-uri")
const EventEmitter = require("events").EventEmitter

class Bootstrapper extends EventEmitter{
    constructor(){
        super();
        this.qbt = QBT.connect("http://127.0.0.1:8080", "admin", "adminadmin")
    }

    checkQbtConnection(){
        return new Promise((resolve, reject)=>{
            console.log("Checking QBT connection...");
            this.qbt.version((err, data)=>{
                if (err){
                    console.log(`QBT connection error: ${err}`);
                    reject(err)
                }else{
                    console.log("QBT connection successful");
                    resolve()
                }
            })
        })
    }


    async getManifest(magnet){
        return this.getTorrent(magnet);
    }

    getTorrent(magnet){
        let self = this;
        console.log("Getting torrent " + magnet );

        return new Promise((resolve, reject)=>{
            let awaitDownload = function(infohash){
                console.log(`Awaiting download: ${infohash}`);
                self.qbt.active((err, res=[])=>{
                    if (err){
                        console.log(`Error downloading manifest: ${err}`);
                        reject(err)
                        return
                    }
                    let torrent = res.filter((torrent)=>{
                        return torrent.hash.toLowerCase() === infohash.toLowerCase()
                    })[0]

                    if (!torrent){
                        console.log(`Error downloading manifest: ${err}`);
                        reject(err)
                        return;
                    }

                    if (torrent.progress === 1){
                        console.log("Torrent downloaded!")
                        resolve(infohash)
                    } else {
                        console.log(`Progress: ${torrent.progress}`);
                        setTimeout(awaitDownload, 1000);
                    }
                })

            }
            console.log("About to add torrent");

            self.qbt.add(magnet, (err, result)=>{
                let infohash = parseMagnet(magnet).infoHash;
                if (err){
                    console.log(`Error downloading manifest: ${err}`);
                    reject(err)
                } else {
                    console.log("Torrent added. awaiting...");
                    awaitDownload(infohash);
                }
            })

        })

    }


    bootstrap(manifestMagnet){

    }

}

module.exports = Bootstrapper
