const Err = require("./IError.js");
const iCrypto = require("./iCrypto.js");
const ss = require('socket.io-stream');
const Logger = require("./Logger.js");

class FileDownloader{
    constructor(socket = Err.required(),
                historyManager = Err.required(),
                crossIslandDataTransporter = Err.required()){
        this.hm = historyManager;
        this.cidTransporter = crossIslandDataTransporter;
        socket.on('download_attachment', async (data)=>{
            try{
            await this.downloadAttachment(socket, data, this)
        }catch(err){
            Logger.error("Download attachment error: " + err )
            socket.emit("download_failed", err.toString());
        }

    });

    socket.on('proceed_download', async (data)=>{
        this.proceedDownload(socket, data, this)
    })
}

/**
    *
    */
async downloadAttachment(socket, data, self){
    console.log("downloadAttachment: Got download_attachment request");
    // If requested file found locally - just push it to the client browser
    let link = data.link;
    let myPkfp = data.myPkfp;
    let fileOwnerPublicKey = await self.hm.getParticipantPublicKey(myPkfp, link.pkfp)
    Logger.debug("File owner key obtained: " + fileOwnerPublicKey);
    if (self.hm.fileExists(myPkfp, link.name)){
        await self.verifyAttachmentFile(myPkfp, fileOwnerPublicKey, link.name, data.hashEncrypted, data.signEncrypted);
        let key = await self.hm.getSharedKeysSet([data.metaID], myPkfp);
        console.log("File found locally. Notifying client...");
        socket.emit("download_ready", key);
    } else if(myPkfp === data.pkfp){
        console.log("I am the owner but file is missing");
    }else{
        //Trying to get file from peer
        socket.emit("requesting_peer");
        console.log("File not found locally. Trying to get it from the owner");
        data.pubKey = fileOwnerPublicKey;
        await self.cidTransporter.getFileFromPeer(data);
        let key = await self.hm.getSharedKeysSet([data.metaID], myPkfp);
        console.log("File successfully obtained and can be transferred to client. Notifying...");
        socket.emit("download_ready", key);
    }
}


    /**
     * If this event received - it means that all the
     * islands checks were completed and file is available for download
     * So we just start pumping the data
     */
    proceedDownload(socket, data, self){
        console.log("Proceeding download received");
        let link = data.link;
        let mypkfp = data.pkfp;
        let stream = ss.createStream();
        console.log(data.pkfp + "  |  " + link.name);
        let fileStream = self.hm.createAttachmentFileStream(mypkfp, link.name, "r");
        ss(socket).emit("file", stream);

        fileStream.on("readable", ()=>{
            let chunk;
            while(null !== (chunk = fileStream.read())){
                console.log("SENDING CHUNK: "  + new Uint8Array(chunk.slice(0, 32)));
                stream.write(chunk);
            }
        });
        fileStream.on("end", ()=>{
            stream.end();
        })
    }

    getAttachmentFileHash(pkfp, fileName, hashAlgorithm = "sha256"){
        return new Promise(async (resolve, reject)=>{
            console.log("Calculating attachment file hash: pkfp: " + pkfp+" filename: " + fileName );
            let self = this;
            let readStream = self.hm.createAttachmentFileStream(pkfp, fileName, "r");
            let ic = new iCrypto();
            ic.createHash("h", hashAlgorithm);

            readStream.on("error", err=>{
                reject(err);
            });

            readStream.on("readable", ()=>{
                let chunk;
                while(null !== (chunk = readStream.read())){
                    ic.updateHash("h", new Uint8Array(chunk));
                }
            });

            readStream.on("end", ()=>{
                ic.digestHash("h", "hres");
                resolve(ic.get("hres"));
            })
        })
    }

    /**
     * Given signature and hash finds the file,
     * calculates its hash, verifies the signature
     * and resolves with object result: true/false, err: err
     * @param pkfp
     * @param filename
     * @param sign
     * @param metaID
     * @returns {Promise<any>}
     */
    verifyAttachmentFile(topicOwnerPkfp, fileOwnerPublicKey, filename, hash,  sign){
        return new Promise(async (resolve, reject)=>{
            let self = this;
            try{

                Logger.debug("Verifying attachment file. Filename: " + filename )
                //Calcluate hash of existing file
                let publicKey = fileOwnerPublicKey;
                let calculatedHash = await self.getAttachmentFileHash(topicOwnerPkfp, filename);

                if(calculatedHash !== hash){
                    let errMsg = "verifyAttachmentFile: passed hash does not match calculated hash\nCalculated hash: " + calculatedHash+"\nPassed hash: " + hash;

                    reject(errMsg);
                    return;
                }

                //check signature of the hash
                let ic = new iCrypto();
                ic.addBlob("h", hash)
                    .hexToBytes("h", "hraw")
                    .asym.setKey("pubk", publicKey, "public")
                    .addBlob("sign", sign)
                    .publicKeyVerify("h", "sign", "pubk", "vres");

                if(!ic.get("vres")){
                    let errMsg = "verifyAttachmentFile: Signature error";
                    console.log(errMsg);
                    reject(errMsg)
                }else{
                    console.log("Attachment is verified");
                    resolve()
                }
            }catch(err){
                reject("verifyAttachmentFile:  " + err);
            }

        })
    }

}

module.exports = FileDownloader;
