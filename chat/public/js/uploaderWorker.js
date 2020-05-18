importScripts("/js/iCrypto.js");
importScripts("/js/socket.io.js");
importScripts("/js/forge.min.js");
importScripts("/js/sjcl.js");
importScripts("/js/socket.io-stream.js");
importScripts("/js/lzma-worker.min.js");
importScripts("/js/chacha.js");

let commandHandlers = {
    "upload": uploadAttachment
};

onmessage = ev => {
    console.log("Received message from main thread: " + ev.data.command);
    processMessage(ev.data);
};

function processMessage(msg) {
    console.log("Processing message from main thread..");
    commandHandlers[msg.command](msg);
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
function processUpload(file, pkfp, privK, symk, fileSocket) {
    return new Promise((resolve, reject) => {
        console.log("Processing upload");
        let stream = ss.createStream();

        console.log("Uploading and encrypting chunk by chunk");
        let offset = 0;
        let bufferSize = 1024 * 64;
        let fileSize = file.size;
        let ic = new iCrypto();
        ic.ssym.init("cha", symk).createHash("unenc") //hash of unencrypted
        .createHash("enc") //has of encrypted
        .createNonce("nonce", 8).asym.setKey("privk", privK, "private").privateKeySign("nonce", "privk", "sign").bytesToHex("nonce", "noncehex");

        console.log("NONCE: " + ic.get('noncehex'));

        fileSocket.on("invalid_request", () => {
            console.error("WORKER: Invalid request event received");
            finishOnError(fileSocket, "invalid_request");
            reject("invalid_request");
        });

        /**
         * Emited by Island after file has been successfully written,
         * renamed and saved.
         * Closing connection, notifying main thread.
         */
        fileSocket.on("upload_success", () => {
            console.log("upload successfull!");
            fileSocket.disconnect();
            postMessage({
                result: "upload_complete",
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
            console.log("WORKER Upload error: " + err);
            finishOnError(fileSocket, "upload_error", err);
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
                console.log("Read error: " + ev.target.error);
                finishOnError(fileSocket, "upload_error", ev.target.error);
                reject(ev.target.error);
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

function finishOnError(fileSocket, result, errorMsg) {
    if (fileSocket && fileSocket.connected) {
        fileSocket.disconnect();
    }
    postMessage({
        result: result,
        data: errorMsg
    });
}

async function uploadAttachment(msg) {
    let attachment = msg.attachment;
    let pkfp = msg.pkfp;
    let privK = msg.privk;
    let symk = msg.symk;
    let fileSocket = await establishConnection();
    await processUpload(attachment, pkfp, privK, symk, fileSocket);
    console.log("Upload successfull");
    //TODO Send message to main thread
    postMessage(["upload_complete"]);
}

function establishConnection() {
    return new Promise((resolve, reject) => {
        console.log("Connecting to file socket");
        let fileSocket = io('/file', {
            reconnection: true,
            forceNew: true,
            upgrade: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });

        fileSocket.on("connect", () => {
            console.log("File transfer connectiopn established");
            resolve(fileSocket);
        });

        fileSocket.on("connect_error", err => {
            console.log('Island connection failed: ' + err.message);
            reject(err);
        });
    });
}

/**
 * Encrypts and uploads file chunk by chunk
 * @param file
 */
function encryptAndUpload(msg) {
    console.log("encryptUpload in worker called");
    let file = msg[1];
    let fileSize = file.size;
    let bufferSize = 128 * 1024;
    let offset = 0;

    let chunkReaderBlock = (_offset, bufferLength, _file) => {
        let reader = new FileReader();
        let blob = _file.slice(_offset, _offset + bufferLength);

        reader.onload = readEventHandler;
        reader.onerror = errorEventHandler;
        reader.readAsArrayBuffer(blob);
    };

    let handleBlock = block => {};

    let readEventHandler = ev => {
        if (ev.target.error === null) {
            offset += bufferSize;
            handleBlock(ev.target.result);
        } else {
            console.log("Read error: " + ev.target.error);
            return;
        }
        if (offset >= fileSize) {
            console.log("Done reading file");
            return;
        }

        chunkReaderBlock(offset, bufferSize, file);
    };

    let errorEventHandler = ev => {
        console.log("Read error: " + ev.target.error);
    };
}

function chachaEncrypt(file = undefined) {
    let ic = new iCrypto();
    let self = chat;
    let keyStruct = self.session.metadata.sharedKey;
    let iv = forge.util.hexToBytes(keyStruct.iv);
    let key = forge.util.hexToBytes(keyStruct.key);
    let arr = str2ab(txt);
    if (file) {
        let fr = new FileReader();
        fr.readAsArrayBuffer(file);
        fr.onload = () => {
            console.log("File loaded! Encrypting!");
            let ab = fr.result;
            let chacha = new JSChaCha20(new Uint8Array(str2ab(key).slice(0, 32)), new Uint8Array(str2ab(iv)).slice(0, 12), undefined);
            let offset = 0;
            let bufferSize = 1024 * 64;
            let res = new Uint8Array(0);
            let t1 = performance.now();
            while (offset < ab.byteLength) {
                let chunk = chacha.encrypt(new Uint8Array(ab.slice(offset, Math.min(offset + bufferSize, ab.byteLength))));
                offset += bufferSize;
                console.log("Appending chunk from " + offset + " to " + Math.min(offset + bufferSize, ab.byteLength));
                //res = concat2Uint8Arrays(res, chunk);
            }
            let t2 = performance.now();
            console.log("All chunks are encrypted! That took: " + (t2 - t1));
        };
    }
}
