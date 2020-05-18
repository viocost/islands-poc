import { iCrypto } from "./iCrypto"
import * as io from "socket.io-client";
import { WildEmitter } from "./WildEmitter";
import * as ss from "socket.io-stream";

export class FileWorker{

    constructor(transport){
        console.log(`Downloader initialized non-worker`);
        // can be 1 - websocket or 0 - xhr
        this.transport = transport;
        WildEmitter.mixin(this);
    }


    processMessage(msg) {
        console.log("Processing message from main thread..");
        commandHandlers[msg.command](msg.data);
    }


    parseFileLink(link) {
        let ic = new iCrypto();
        ic.addBlob('l', link).base64Decode("l", "ls");
        let parsed = ic.get("ls");
        let splitted = parsed.split("/");
        return {
            onion: splitted[0],
            pkfp: splitted[1],
            name: splitted[2]
        };
    }

    postMessage(data){
        this.emit("message",  {data: data});
    }

    /**
    * Concatenates 2 buffers
    * @param buffer1
    * @param buffer2
    * @returns {ArrayBufferLike}
    */
    appendBuffer(buffer1, buffer2) {
        let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
        return tmp.buffer;
    };

    uploadFile(data) {
        let self = this;
        let attachment = data.attachment;
        let pkfp = data.pkfp;
        let privK = data.privk;
        let symk = data.symk;

        this.processUpload(attachment, pkfp, privK, symk)
            .then((data)=>{
                console.log(`Upload resolved successfully!`)
                self.postMessage(data);
            })
            .catch(err=>{
                console.log(`File upload error: ${err}`);
                self.postMessage({message: "upload_error", data: err});
            })
    }


    /**
    * Uploads and encrypts a file to the Island and
    * calculates encrypted and unencrypted hashes
    * @param attachment
    * @param pkfp
    * @param privK
    * @param symk
    * @param fileSocket
    * @returns {Promise<any>}
    */
    processUpload(file, pkfp, privK, symk) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            self.postMessage({message: "log", data: "Processing upload"});
            let fileSocket;
            try{
                fileSocket = await this.establishConnection();
            }catch (e) {
                reject("Connection error: " + e)
            }

            let stream = ss.createStream();

            self.postMessage({message: "log", data: "Uploading and encrypting chunk by chunk"});
            let offset = 0;
            let bufferSize = 1024 * 64;
            let fileSize = file.size;
            let ic = new iCrypto();
            ic.ssym.init("cha", symk).createHash("unenc") //hash of unencrypted
            .createHash("enc") //has of encrypted
            .createNonce("nonce", 8).asym.setKey("privk", privK, "private").privateKeySign("nonce", "privk", "sign").bytesToHex("nonce", "noncehex");

            console.log("NONCE: " + ic.get('noncehex'));

            fileSocket.on("invalid_request", () => {
                reject("Upload request is invalid");
            });

            /**
            * Emited by Island after file has been successfully written,
            * renamed and saved.
            * Closing connection, notifying main thread.
            */
            fileSocket.on("upload_success", () => {
                self.postMessage({message: "log", data: "Upload successful"})
                fileSocket.disconnect();
                resolve({
                    message: "upload_complete",
                    data: {
                        hashEncrypted: ic.get("encres"),
                        hashUnencrypted: ic.get("unencres")
                    }
                });
            });

            fileSocket.on("upload_ready", () => {
                console.log("received upload_ready. Pumping data");
                chunkReaderBlock(offset, bufferSize, file);
            });

            fileSocket.on("upload_error", err => {
                reject(err);
            });

            /**
            * Event emited by Island after hash received
            * and file is ready to be renamed
            */
            fileSocket.on("end_stream", () => {
                stream.end();
            });

            let errorEventHandler = ev => {
                console.error("Error processing upload: " + ev.target.error);
                reject(ev.target.error);
            };

            let readEventHandler = ev => {

                if (ev.target.error === null) {
                    offset = Math.min(offset + bufferSize, fileSize);
                    handleBlock(ev.target.result);
                } else {
                    reject("Read error: " + ev.target.error);
                    return;
                }

                if (offset >= fileSize) {
                    ic.digestHash("unenc", "unencres");
                    ic.digestHash("enc", "encres");
                    ic.asym.sign("unencres", "privk", "unencressign");
                    fileSocket.emit("finalize_upload", { hashUnencrypted: ic.get("unencres") });
                    return;
                }
                chunkReaderBlock(offset, bufferSize, file);
            };

            let chunkReaderBlock = (_offset, bufferSize, _file) => {
                let reader = new FileReader();
                let upperBound = Math.min(_offset + bufferSize, fileSize);
                let blob = _file.slice(_offset, upperBound);
                reader.onload = readEventHandler;
                reader.onerror = errorEventHandler;
                reader.readAsArrayBuffer(blob);
            };

            let handleBlock = chunk => {
                ic.updateHash("unenc", chunk);
                let encrypted = ic.ssym.encrypt("cha", chunk);
                ic.updateHash("enc", encrypted);
                let b = new ss.Buffer(encrypted);
                stream.write(b);
            };



            /**
            * Initializing file upload
            */
            ss(fileSocket).emit('upload_attachment', stream, {
                pkfp: pkfp,
                nonce: ic.get("noncehex"),
                sign: ic.get("sign")
            });
        });
    }


    downloadFile(data){
        this.processDownload(data)
            .then((dataBuffer)=>{
                this.postMessage({ message: "download_complete", data: dataBuffer });
                console.log("Stream finished");
            })
            .catch(err=>{
                console.log("Error downloading file: " + err);
                this.postMessage({ message: "download_failed", data: err })
            })
    }



    processDownload(data) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            console.log(`Initializing file download`);
            const fileInfo = JSON.parse(data.fileInfo);
            const link = self.parseFileLink(fileInfo.link);
            const myPkfp = data.myPkfp;
            const privk = data.privk;
            const ownerPubk = data.pubk;
            const metaID = fileInfo.metaID;


            let fileSocket;
            try{
                fileSocket = await this.establishConnection();
            }catch (e) {
                reject("Connection error: " + e)
            }

            /**
            * event triggered by Island when file is ready to be transferred to the client
            * key is encrypted shared SYM key to decrypt file
            */

            fileSocket.on("download_ready", key => {
                //prepare file
                self.postMessage({ message: "file_available_locally"});
                let symk = key[metaID];
                let dataBuffer = new ArrayBuffer(0);
                ss(fileSocket).on("file", stream => {

                    console.log("File download in progress!");
                    let ic = new iCrypto();
                    ic.addBlob("k", symk).asym.setKey("privk", privk, "private").asym.decrypt("k", "privk", "symk", "hex");
                    ic.createHash("h");

                    ic.ssym.init("stc", ic.get("symk"), false);

                    stream.on('data', data => {

                        self.postMessage({ message: "log", data: "Received data chunk" })
                        let chunk = ic.ssym.decrypt("stc", data.buffer);
                        ic.updateHash("h", new Uint8Array(chunk));
                        dataBuffer = iCrypto.concatArrayBuffers(dataBuffer, chunk);
                    });
                    stream.on('end', () => {
                        self.postMessage({ message: "log", data: "Received end of data message" })
                        ic.digestHash("h", "hres").addBlob("sign", fileInfo.signUnencrypted).asym.setKey("pubk", ownerPubk, "public").asym.verify("hres", "sign", "pubk", "vres");

                        if (!ic.get("vres")) {
                            reject("File validation error!");
                        } else {

                            self.postMessage({ message: "log", data: "Resolving data..." })
                            resolve(dataBuffer);
                        }
                    });
                });

                //create stream
                //emit
                console.log("About to emit process_download");
                fileSocket.emit("proceed_download", {
                    link: link,
                    pkfp: myPkfp

                });
            });

            fileSocket.on("requesting_peer", ()=>{
                console.log("File not found locally, requesting hidden peer")
                self.postMessage({ message: "requesting_peer"});
            })

            fileSocket.on("download_failed", err =>{
                console.log("File download fail: " + err);
                self.postMessage({ message: "download_failed", data: err })
            })

            fileSocket.emit("download_attachment", {
                link: link,
                myPkfp: myPkfp,
                metaID: fileInfo.metaID,
                hashEncrypted: fileInfo.hashEncrypted,
                signEncrypted: fileInfo.signEncrypted
            });
        });
    }



    establishConnection() {
        let self = this;
        return new Promise((resolve, reject) => {
            console.log("Connecting to file socket...")
            let maxAttempts = 5;
            let reconnectionDelay = 5000 //ms
            let attempted = 0;

            self.postMessage({ message: "log", data: "Connecting to file socket..." })

            const socketConfig = {
                autoConnect: false,
                reconnection: false,
                pingInterval: 10000,
                pingTimeout: 5000
            }

            socketConfig.upgrade = self.transport > 0;

            let fileSocket = io('/file', socketConfig);

            let attemptConnection = ()=>{
                self.postMessage({ message: "log", data: "Attempting connection: " + attempted })
                fileSocket.open()
            }

            let connectionFailHandler = (err)=>{

                if (attempted < maxAttempts){
                    let msg = `Connection error on attempt ${attempted}: ${err}`
                    self.postMessage({ message: "log", data: msg})
                    attempted++;
                    setTimeout(attemptConnection, reconnectionDelay)
                } else {
                    let msg = `Connection error on attempt ${attempted}: ${err}\nRejecting!`
                    self.postMessage( { message: "log", data: msg })
                    reject(err);
                }
            }

            fileSocket.on("connect", () => {
                self.postMessage({ message: "log", data: "File transfer connection established" })
                resolve(fileSocket);
            });

            fileSocket.on("connect_error", err => {
                connectionFailHandler(err)
            });

            fileSocket.on("connect_timeout", () =>{
                connectionFailHandler("Connection timeout.")
            })

            attemptConnection();
        });
    }

}
