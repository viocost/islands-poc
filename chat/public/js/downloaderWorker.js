importScripts("/js/iCrypto.js");
importScripts("/js/socket.io.js");
importScripts("/js/forge.min.js");
importScripts("/js/sjcl.js");
importScripts("/js/socket.io-stream.js");
importScripts("/js/lzma-worker.min.js");
importScripts("/js/chacha.js");

let commandHandlers = {
    "download": downloadFile
};

onmessage = ev => {
    console.log("Downloader received message from main thread: " + ev.command);
    processMessage(ev.data)

};

function processMessage(msg) {
    console.log("Processing message from main thread..");
    commandHandlers[msg.command](msg.data);
}

function parseFileLink(link) {
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

/**
 * Concatenates 2 buffers
 * @param buffer1
 * @param buffer2
 * @returns {ArrayBufferLike}
 */
let appendBuffer = function (buffer1, buffer2) {
    let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
};



function downloadFile(data){
    iCrypto = data.iCrypto;
    processDownload(data)
        .then((dataBuffer)=>{
            postMessage({ message: "download_complete", data: dataBuffer });
            console.log("Stream finished");
        })
        .catch(err=>{
            console.log("Error downloading file: " + err);
            postMessage({ message: "download_failed", data: err })
        })
}


function processDownload(data) {
    return new Promise(async (resolve, reject) => {
        const fileInfo = JSON.parse(data.fileInfo);
        const link = parseFileLink(fileInfo.link);
        const myPkfp = data.myPkfp;
        const privk = data.privk;
        const ownerPubk = data.pubk;
        const metaID = fileInfo.metaID;


        let fileSocket;
        try{
           fileSocket = await establishConnection();
        }catch (e) {
            reject("Connection error: " + e)
        }

        /**
         * event triggered by Island when file is ready to be transferred to the client
         * key is encrypted shared SYM key to decrypt file
         */

        fileSocket.on("download_ready", key => {
            //prepare file
            postMessage({ message: "file_available_locally"});
            let symk = key[metaID];
            let dataBuffer = new ArrayBuffer(0);
            ss(fileSocket).on("file", stream => {

                console.log("File download in progress!");
                let ic = new iCrypto();
                ic.addBlob("k", symk).asym.setKey("privk", privk, "private").asym.decrypt("k", "privk", "symk", "hex");
                ic.createHash("h");

                ic.ssym.init("stc", ic.get("symk"), false);

                stream.on('data', data => {

                    postMessage({ message: "log", data: "Received data chunk" })
                    let chunk = ic.ssym.decrypt("stc", data.buffer);
                    ic.updateHash("h", new Uint8Array(chunk));
                    dataBuffer = iCrypto.concatArrayBuffers(dataBuffer, chunk);
                });
                stream.on('end', () => {
                    postMessage({ message: "log", data: "Received end of data message" })
                    ic.digestHash("h", "hres").addBlob("sign", fileInfo.signUnencrypted).asym.setKey("pubk", ownerPubk, "public").asym.verify("hres", "sign", "pubk", "vres");

                    if (!ic.get("vres")) {
                        reject("File validation error!");
                    } else {

                        postMessage({ message: "log", data: "Resolving data..." })
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
            postMessage({ message: "requesting_peer"});
        })

        fileSocket.on("download_failed", err =>{
            console.log("File download fail: " + err);
            postMessage({ message: "download_failed", data: err })
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

function establishConnection() {
    return new Promise((resolve, reject) => {
        console.log("Connecting to file socket...")
        let maxAttempts = 5;
        let reconnectionDelay = 5000 //ms
        let attempted = 0;

        postMessage({ message: "log", data: "Connecting to file socket..." })
        let fileSocket = io('/file', {
            autoConnect: false,
            reconnection: false,
            forceNew: true,
            upgrade: false,
            pingInterval: 10000,
            pingTimeout: 5000
        });

        let attemptConnection = ()=>{
            postMessage({ message: "log", data: "Attempting connection: " + attempted })
            fileSocket.open()
        }

        let connectionFailHandler = (err)=>{

            if (attempted < maxAttempts){
                let msg = `Connection error on attempt ${attempted}: ${err}`
                postMessage({ message: "log", data: msg})
                attempted++;
                setTimeout(attemptConnection, reconnectionDelay)
            } else {
                let msg = `Connection error on attempt ${attempted}: ${err}\nRejecting!`
                postMessage({ message: "log", data: msg })
                reject(err);
            }
        }

        fileSocket.on("connect", () => {
            postMessage({ message: "log", data: "File transfer connection established" })
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
