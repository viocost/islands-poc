const ss = require('socket.io-stream');
const Err = require("../libs/IError.js");
const iCrypto = require("../libs/iCrypto.js");
const Logger = require("./Logger")


class FileUploader{
    constructor(socket = Err.required(),
                historyManager = Err.required){
        this.hm = historyManager;
        this.hashUnencrypted = null;

        ss(socket).on("upload_attachment",async (stream, data)=>{
            Logger.debug("Received upload attachment.")
            await this.processUploadAttachment(socket, stream, data);
        });

        socket.on("finalize_upload", data=>{
            this.finalizeUpload(socket, data);
        });

    }

    async processUploadAttachment(socket, stream, data){
        let self = this;

        let bytesReceived = 0;
        let ic = new iCrypto();
        ic.createHash("h");
        console.log("Received file. Verifying request...");
        let verified = await self.verifyNonce(data.pkfp, data.nonce, data.sign, true);

        if (!verified){
            throw new Error("invalid_request");
        }

        let tempFileName = data.nonce + ".temp";
        let fileStream = self.hm.createAttachmentFileStream(data.pkfp, tempFileName);
        stream.on("finish", async ()=>{
            console.log("Received end of stream. HashUnencrypted set to " + self.hashUnencrypted)
            ic.digestHash("h", "hres");
            console.log("HASH encrypted is " + ic.get("hres"));
            let tempName = data.nonce + ".temp";
            console.log("About to rename");
            fileStream.end(); // to free the file
            await self.hm.renameTempUpload(data.pkfp, tempName, self.hashUnencrypted);
            console.log("Rename success, notifying client!");
            socket.emit("upload_success");
        });

        stream.on("data", (chunk)=>{
            bytesReceived += chunk.byteLength;
            console.log(new Uint8Array(chunk.slice(0, 32)).toString());
            ic.updateHash("h", chunk);
            fileStream.write(chunk);
        });
        console.log("Request verified. Stream created. emitting upload_ready");
        socket.emit('upload_ready')
    }

    finalizeUpload(socket, data){
        console.log("Finalize upload called setting hashUnencrypted to " + data.hashUnencrypted);
        this.hashUnencrypted = data.hashUnencrypted;
        console.log("Hash set. Now ready to end stream");
        socket.emit("end_stream");
    }


    /**************************************************
     *HELPERS
     *************************************************/
    verifyNonce(pkfp, nonce, sign, dehexify = false){
        return new Promise(async (resolve, reject)=>{
            let publicKey = await this.hm.getOwnerPublicKey(pkfp);
            let ic = new iCrypto();
            if (dehexify){
                ic.addBlob("nh", nonce)
                    .hexToBytes("nh", "nonce")
            }else{
                ic.addBlob("nonce", nonce);
            }
            ic.asym.setKey("pubk", publicKey, "public")
                .addBlob("sign", sign)
                .publicKeyVerify("nonce","sign", "pubk", "res");
            resolve(ic.get("res"));
        })
    }

    /**************************************************
     *~END HELPERS
     *************************************************/


}

module.exports = FileUploader;
