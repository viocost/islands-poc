const Err = require("./IError.js");
const iCrypto = require("./iCrypto.js");
const ss = require('socket.io-stream');
const Logger = require("./Logger.js");

class CrossIslandDataTransporter{
    constructor(connector = Err.required(),
                historyManager = Err.required()){
        this.connector = connector;
        this.hm = historyManager;
        this.pendingInterIslandFileRequests = {}

        this.connector.on("get_file", (socket, data)=>{
            this.processInterIslandGetFileRequest(socket, data);
        });

    }


    /**
     * Data must have file hash as name, pkfp of uploader, residence(onion address) of uploader
     * @param data - {
     *      link: {
     *          onion: onionAddress residence of the user who uploaded the file
     *          pkfp: pkfp of user who uploaded the file
     *          name: hash unencrypted as file name
     *      },
     *      myPkfp,
     *      hashEncrypted: hash of ENCRYPTED file
     *      signEncrypted: uploader's signature of ENCRYPTED hash
     *      pubKey: public key of uploader to verify signature
     *
     * }
     * @returns {Promise<any>}
     */
    getFileFromPeer(data){
        return new Promise(async (resolve, reject)=>{
            //create temp name
            let ic = new iCrypto()
            ic.createNonce("n", 8)
                .bytesToHex("n", "nh");
            let tempName = ic.get("nh") + ".temp";
            data.tempName = tempName;

            //verify data
            try{
                //save pending file request
                console.log("Inside getFilefrpPeer function");
                let self = this;
                self.setPendingInterIslandFileRequest(tempName, data);

                //establish connection with peer
                let socket = await self.connector.callPeerFileTransfer(data.link.onion);

                //Creating write stream for file
                let stream =  self.hm.createAttachmentFileStream(data.myPkfp, tempName);

                //event handlers for stream
                stream.on('finish', async ()=>{
                    try{
                        console.log("Renaming temp file");
                        await self.hm.renameTempUpload(data.myPkfp, tempName, data.link.name);
                        //All set. File transferred from peer
                        resolve()
                    }catch(err){
                        Logger.error(`Error renaming temp file after file tranfer: ${err.message}`, {stack: err.stack, cat: "files"})
                        reject(err);
                    }
                });

                stream.on('error', (err)=>{
                    Logger.error(`Stream error while transferring file from hidden peer: ${err.message}`, {stack: err.stack, cat: "files"})
                    reject(err);
                })

                //Begin transfer
                await self.transferAndVerifyFileFromPeer(socket, stream, data, data.hashEncrypted, data.signEncrypted, data.pubKey)
                stream.end();

            }catch(err){
                reject(err);
            }
        })
    }

    /**
     *
     * @param data
     * data must have
     *  socket - tor socket that file will be streamed to
     *  data - requested file info including
     *      pkfpSource - pkfp of the one who requested the file
     *      pkfpDest - pkfp of file owner
     *      name - filename (file hash)
     *      (signature?)
     *
     */
    processInterIslandGetFileRequest(socket, link){
        console.log("Processing interislnad get_file request");
        let self = this;
        console.log("About to check if file exists");
        if (!self.hm.fileExists(link.pkfp, link.name)){
            //file not found => return not found
            console.log("Crossisland incoming file request: File not found");
            socket.emit("file_not_found");
            return;
        }
        //file found => transfer
        let stream = ss.createStream();
        let fileReadStream = self.hm.createAttachmentFileStream(link.pkfp, link.name, "r");
        ss(socket).emit("file", stream);
        fileReadStream.pipe(stream);
        fileReadStream.on("end", () =>{
            console.log("Emiting transfer success");
            stream.end();
        })
    }

    /**
     * Sends interislands get_file request
     *
     * @param socket - the connection with hidden peer
     * @param data - requested file description
     * @param writeStream - prepared write stream for file data
     * @param {string} hash - of encrypted file in hex
     * @param {string} signature - signature of the encrypted hash
     * @param {string} publicKey - public key to check signature against
     * @returns {Promise<any>}
     */
    transferAndVerifyFileFromPeer(socket,  writeStream, data, hash, signature, publicKey){
        return new Promise((resolve, reject)=>{
            try{
                let ic = new iCrypto();
                ic.createHash("h");
                ss(socket).on('file', (stream)=>{
                    let finishOnError = (errMsg) =>{
                        socket.disconnect();
                        reject(errMsg);
                    };

                    console.log("Got the file! Writing!");
                    stream.on("data", chunk=>{
                        ic.updateHash("h", new Uint8Array(chunk));
                        writeStream.write(chunk);
                    });

                    stream.on("end", ()=>{
                        //Check hash
                        ic.digestHash("h", "hres");
                        if(ic.get("hres") !== hash){
                            finishOnError("hash is invalid");
                            return
                        }

                        ic.addBlob("sign", signature)
                            .asym.setKey("pubk", publicKey, "public")
                            .asym.verify("hres", "sign", "pubk", "vres");

                        if (!ic.get("vres")){
                            finishOnError("Signature was not verified");
                            return
                        }

                        console.log("File transfer finished successfully. Disconnecting...");
                        socket.disconnect(true);
                        resolve();
                    })
                });


                socket.on("file_not_found", ()=>{
                    this.hm.deleteFileOnTransferFail(data.myPkfp, data.name);
                    reject("File not found");
                });

                socket.on("disconnect", (reason)=>{
                    if(!/client/.test(reason)){
                        //reason for disconnect was not the client,
                        //Meaning that the file is probably didn't transfer completely
                        reject("File transfer failed")
                    }

                });

                socket.emit("get_file", data.link);
            }catch(err){
                console.log("Error transferAndVerifyFileFromPeer: " + err);
                reject(err, data);
            }
        })
    }

    setPendingInterIslandFileRequest(tempName, data){
        this.pendingInterIslandFileRequests[tempName] = data
    }
}


module.exports = CrossIslandDataTransporter;
