importScripts("/js/forge.min.js");
importScripts("/js/sjcl.js");
importScripts("/js/iCrypto.js");

let commandHandlers = {
    "hashFile": processHashFile
};

onmessage = ev => {
    console.log("iCrypto worker received message: " + ev.data[0]);
    processMessage(ev.data);
};

function processMessage(msg) {
    console.log("Processing message from main thread..");
    commandHandlers[msg[0]](msg);
}

function processHashFile(msg) {
    getHash(msg[1]).then(hash => {
        //return hash to main thread
        postMessage(["success", hash]);
    }).catch(err => {
        //return error to main thread
        postMessage(["error", err]);
    });
}

function getHash(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject("getHash worker: File is not defined");
            return;
        }
        console.log("Calculating hash...");
        let offset = 0;
        let fileSize = file.size;
        let bufferSize = 1024 * 256;
        let ic = new iCrypto();
        ic.createHash("h");
        let errorEventHandler = ev => {
            console.log("Read error: " + ev.target.error);
        };

        let readEventHandler = ev => {
            if (ev.target.error === null) {
                offset = Math.min(offset + bufferSize, fileSize);
                handleBlock(ev.target.result);
            } else {
                console.log("Read error: " + ev.target.error);
                return;
            }
            if (offset >= fileSize) {
                ic.digestHash("h", "hres");
                console.log("Hash calcluated.");
                resolve(ic.get("hres"));
                return;
            }

            chunkReaderBlock(offset, bufferSize, file);
        };

        let chunkReaderBlock = (_offset, bufferSize, _file) => {
            let reader = new FileReader();
            let blob = _file.slice(_offset, Math.min(_offset + bufferSize, fileSize));
            reader.onload = readEventHandler;
            reader.onerror = errorEventHandler;
            reader.readAsBinaryString(blob);
        };
        let handleBlock = blob => {
            ic.updateHash("h", blob);
        };

        chunkReaderBlock(offset, bufferSize, file);
    });
}