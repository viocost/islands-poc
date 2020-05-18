function fileUploadTester(file){
    return new Promise((resolve, reject)=>{
        let self = chat;
        self.establishIslandConnection("file")
            .then(()=>{
                let reader = new FileReader()
                reader.readAsArrayBuffer(file);

                reader.onload = (ev)=>{
                    let bufferSize = 65536;
                    let offset = 0;
                    console.log("Connection established. Creating stream..");
                    let stream = ss.createStream();
                    ss(self.fileSocket).emit('file', stream, {name: file.name, size: file.size, pkfp: self.session.publicKeyFingerprint})

                    let ic = new iCrypto;
                    ic.addBlob("b", reader.result.toString())
                        .hash("b", "bh");

                    ic.createHash("h2")
                        .setSYMKey("sym", self.session.metadata.sharedKey);


                    while(offset < reader.result.byteLength){

                        console.log("Writing to stream bytes " + offset + ", " + offset + bufferSize);
                        let chunk = reader.result.slice(offset, offset+bufferSize)
                        let b = new ss.Buffer(chunk);
                        ic.updateHash("h2", chunk.toString());
                        stream.write(b);
                        offset += bufferSize
                    }
                    ic.digestHash("h2", "h2res");
                    console.log("Hash of whole file: " + ic.get("bh") + "\nHash of chunks: " + ic.get("h2res"));
                    console.log("Done writing buffer");
                    resolve()
                };


                //ss.createBlobReadStream(file).pipe(stream)
            })
    })
}


testForge = (file)=>{
    return new Promise((resolve, reject)=>{
        let reader = new FileReader();
        let buffReader = new FileReader();
        reader.onload = ()=>{
            let bufferSize = 1024*64;
            let offset = 0;
            let hashsjcl = new sjcl.hash.sha256();
            let hash = forge.md.sha256.create();
            let hashChunked = forge.md.sha256.create();
            let wholeBlob = reader.result;
            hash.update(wholeBlob);
            let hashRes = hash.digest().toHex();

            while(offset < reader.result.length){
                console.log("Updating hash with " + offset + ", " + (offset + bufferSize));
                let chunk = reader.result.slice(offset, Math.min(offset+bufferSize, reader.result.length));
                hashChunked.update(chunk);
                offset = Math.min(offset+bufferSize, file.size)
            }

            let chunkedHashRes = hashChunked.digest().toHex();
            resolve(chunkedHashRes);
            //console.log("Hash of whole file: " + hashRes + "\nHash of chunked: " + chunkedHashRes);
        };
        reader.readAsBinaryString(file);
    })
}

testSJCL = (file)=>{
    return new Promise((resolve, reject)=>{
        let buffReader = new FileReader();
        buffReader.onload = ()=>{
            let bufferSize = 1024*64;
            let offset = 0;
            let hashsjcl = new sjcl.hash.sha256();
            let ic = new iCrypto()
            ic.createHash('h')

            while(offset < buffReader.result.byteLength){
                console.log("SJCL Updating hash with " + offset + ", " + (offset + bufferSize));
                let upperBound = Math.min(offset+bufferSize, buffReader.result.byteLength)
                let chunk = buffReader.result.slice(offset, upperBound);
                hashsjcl.update(sjcl.codec.arrayBuffer.toBits(chunk));
                ic.updateHash("h", chunk);
                offset = upperBound
            }

            let res = sjcl.codec.hex.fromBits(hashsjcl.finalize());
            ic.digestHash("h", "hres")
            resolve([res, ic.get("hres")])
        };
        buffReader.readAsArrayBuffer(file);
    })
}

testHash = async (file)=>{
    let t0 = performance.now()
    let forgeHash = await testForge(file);
    let t1 = performance.now();
    let t2 = performance.now();
    let sjclres = await testSJCL(file);
    let t3 = performance.now();
    console.log("Forge: " + forgeHash + "  "+((t1-t0)*1000)+" sec.\nSJCL: " + sjclres[0] +"  "+((t3-t2)*1000)+" sec." + "\niCrypto: " + sjclres[1]);

};

//file = document.querySelector('#attach-file').files[0]

//testHash(file);

function testCrypto(file){
    let reader = new FileReader();
    reader.readAsArrayBuffer(file);

    reader.onload = (ev)=>{
        let bufferSize = 1024;
        let offset = 0;
        console.log("Connection established. Creating stream..");

        let ic = new iCrypto;
        ic.addBlob("b", reader.result)
            .hash("b", "bh");

        ic.createHash("h2")
            .setSYMKey("sym", chat.session.metadata.sharedKey);

        let hash =  forge.md.sha256.create();
        let hash1 = forge.md.sha256.create();

        let receiver = "";

        while(offset < reader.result.byteLength){

            console.log("Writing to stream bytes " + offset + ", " + offset + bufferSize);
            let chunk = reader.result.slice(offset, Math.min(offset+bufferSize, reader.result.byteLength));
            receiver += chunk;
            hash.update(new Uint8Array(chunk));

            offset += bufferSize
        }

        hash1.update(new Uint8Array(reader.result));
        let res1 = hash1.digest().toHex();
        let res = hash.digest().toHex();
        ic.digestHash("h2", "h2res");
        console.log("Hash of whole file: " + ic.get("bh") + "\nHash of chunks: " + res + "n\Hash2: " + res1);
        console.log("Done writing buffer");
        console.log(receiver);
        console.log(reader.result);
        console.log("Outputs are equal: " + (receiver === reader.result));
    };

}



function fileReceiverTester(){

}

function fileDownloadTester(name, pkfpDest, ownerResidence){
    return new Promise((resolve, reject)=>{
        let self = chat;
        self.establishIslandConnection("file")
            .then(()=>{
                ss(self.fileSocket).on("file", (stream, data)=>{

                });
                self.fileSocket.emit("get_file", {
                    name: name,
                    pkfpSource: self.session.publicKeyFingerprint,
                    pkfpDest: pkfpDest,
                    ownerResidence: ownerResidence
                })
            })
    })
}



function testEncryption(file){
    let reader = new FileReader();
    reader.readAsArrayBuffer(file);

    reader.onload = (ev)=>{
        console.log("File loaded");
    };
    return reader;
}


function encryptBlock(cipher, offset, bufferSize, timer, reader){
    return new Promise((resolve, reject)=>{
        setTimeout((offset, bufferSize, timer)=>{

            console.log("inside timeout function. Timer: " + timer + " Encrypting from " + offset + " to "  + (Math.min(offset+bufferSize, reader.result.byteLength )));
            cipher.update(forge.util.createBuffer(reader.result.slice(offset, Math.min(offset+bufferSize, reader.result.byteLength))));
            resolve();
        }, timer, offset, bufferSize, timer)
    })
}

function encryptor(reader){
    return new Promise((resolve, reject)=> {
        let self = chat;
        let keyStruct = self.session.metadata.sharedKey;
        let iv = forge.util.hexToBytes(keyStruct.iv);
        let key = forge.util.hexToBytes(keyStruct.key);
        let cipher = forge.cipher.createCipher("AES-CTR", key);
        cipher.start({iv: iv});
        let offset = 0;
        let bufferSize = 1024 * 64;
        let promises = [];
        let timer = 0;
        let t1 = performance.now()
        while (offset + bufferSize < reader.result.byteLength) {

            console.log("Continnuing encryption with block from " + offset + " to " + (Math.min(offset + bufferSize, reader.result.byteLength)));
            promises.push(encryptBlock(cipher, offset, bufferSize, timer, reader));
            setTimeout((offset, bufferSize, timer)=>{

                console.log("inside immediate function. Encrypting from " + offset + " to "  + (Math.min(offset+bufferSize, reader.result.byteLength )));
                cipher.update(forge.util.createBuffer(reader.result.slice(offset, Math.min(offset+bufferSize, reader.result.byteLength))));
            }, timer, offset, bufferSize, timer);
            offset += bufferSize;
            timer += 200;
        }
        Promise.all(promises).then(() => {
            let t2 = performance.now()
            console.log("Encryption completed. That took: " + (t2-t1) );
            cipher.finish();
            resolve(cipher.output)
        })

    });
}


function decryptBlock(offset, bufferSize, timer, cipher, decipher){
    return new Promise((resolve, reject)=>{
        setTimeout((offset, bufferSize, cipher, decipher)=>{
            console.log("Inside decrypt block timeout function!");
            decipher.update(forge.util.createBuffer(cipher.slice(offset, offset+bufferSize)));
            resolve()
        }, timer, offset, bufferSize, cipher, decipher)
    })
}

function decryptor(cipher){
    return new Promise((resolve, reject)=>{
        let self = chat;
        let keyStruct = self.session.metadata.sharedKey;
        let iv = forge.util.hexToBytes(keyStruct.iv);
        let key = forge.util.hexToBytes(keyStruct.key);
        let decipher = forge.cipher.createDecipher('AES-CTR', key)
        decipher.start({iv: iv});
        let offset = 0;
        let bufferSize = 1024 * 64;
        let promises = [];
        let timer = 0;
        let  cipherBytes = cipher.getBytes();
        while (offset + bufferSize < cipherBytes.length()){
            promises.push(decryptBlock(offset, bufferSize, timer, cipherBytes, decipher))
        }
        Promise.all(promises).then((decipher)=>{
            console.log("Done decryption");
            resolve(decipher)
        })
    })
}

function str2ab(str) {
    var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
    var bufView = new Uint16Array(buf);
    for (var i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

function chachaDecrypt(reader){



}


function concat2Uint8Arrays(arr1, arr2){
    let res = new Uint8Array(arr1.byteLength + arr2.byteLength);
    res.set(arr1, 0);
    res.set(arr2, arr1.byteLength);
    return res;
}

function chachaEncrypt(file = undefined){
    let ic = new iCrypto();
    let self = chat;
    let keyStruct = self.session.metadata.sharedKey;
    let iv = forge.util.hexToBytes(keyStruct.iv);
    let key = forge.util.hexToBytes(keyStruct.key);
    let arr = str2ab(txt);
    if (file){
        let fr = new FileReader;
        fr.readAsArrayBuffer(file);

        fr.onload = () =>{
          console.log("File loaded! Encrypting!");
          let ab = fr.result
          let chacha = new JSChaCha20(new Uint8Array(str2ab(key).slice(0, 32)), new Uint8Array(str2ab(iv)).slice(0, 12), undefined);
            let offset = 0;
            let bufferSize = 1024 * 64;
            let res = new Uint8Array(0);
            let t1 = performance.now();
            while (offset<ab.byteLength){
              let chunk = chacha.encrypt(new Uint8Array(ab.slice(offset, Math.min(offset+bufferSize, ab.byteLength))))
              offset += bufferSize;
              console.log("Appending chunk from " + offset + " to " + Math.min(offset+bufferSize, ab.byteLength));
              //res = concat2Uint8Arrays(res, chunk);
            }
            let t2 = performance.now();
            console.log("All chunks are encrypted! That took: " + (t2-t1));

        };

    }

    // let chacha = new JSChaCha20(new Uint8Array(str2ab(key).slice(0, 32)), new Uint8Array(str2ab(iv)).slice(0, 12), undefined);
    //
    // let offset = 0;
    // let bufferSize = 64;
    //
    // let ab = str2ab(txt)
    // let res = new Uint8Array(0);
    //
    // while (offset<ab.byteLength){
    //     let chunk = chacha.encrypt(new Uint8Array(ab.slice(offset, Math.min(offset+bufferSize, ab.byteLength))))
    //     offset += bufferSize;
    //     console.log("Appending chunk");
    //     res = concat2Uint8Arrays(res, chunk);
    // }
    //
    //
    //
    // console.log("All chunks are encrypted");
    // chacha = new JSChaCha20(new Uint8Array(str2ab(key).slice(0, 32)), new Uint8Array(str2ab(iv)).slice(0, 12), undefined);
    // let decArrayRes = new Uint8Array(0);
    // offset = 0;
    //
    // while (offset<res.byteLength){
    //     let dec = chacha.decrypt(res.slice(offset, Math.min(offset+bufferSize, res.byteLength)));
    //     decArrayRes = concat2Uint8Arrays(decArrayRes, dec);
    //     offset += bufferSize
    // }
    //
    //
    //
    // let decstr = new TextDecoder('utf-16').decode(decArrayRes);
    // console.log(decstr);
    //
    // let beforeEnc = new Uint8Array(ab);
    // decstr = new TextDecoder('utf-8').decode(decArrayRes);
    // console.log(decstr);



    // let cipher = chacha.encrypt(new Uint8Array());
    // let decrypted = chacha.decrypt(cipher).toString();
    //
    // console.log("Encrypted equal decrypted: " + (txt === decrypted));


}

let worker;

function initWorker(){
    worker = new Worker("/js/worker.js");
    worker.onmessage = (ev)=>{

        console.log("Got message from worker: " + ev.data[0])

    }
}



function testWorker(){
    let file = document.querySelector('#attach-file').files[0]
    if (worker){
        worker.postMessage({command: "encrypt_upload", file: file});
    }else{
        console.log("worker uninitialized!");
    }

}

let txt = "For. His quarry cries on hauocke. Oh proud death,\n" +
    "What feast is toward in thine eternall Cell.\n" +
    "That thou so many Princes, at a shoote,\n" +
    "So bloodily hast strooke\n" +
    "\n" +
    "   Amb. The sight is dismall,\n" +
    "And our affaires from England come too late,\n" +
    "The eares are senselesse that should giue vs hearing,\n" +
    "To tell him his command'ment is fulfill'd,\n" +
    "That Rosincrance and Guildensterne are dead:\n" +
    "Where should we haue our thanskes?\n"

    +
    "  Hor. Not from his mouth,\n" +
    "Had it th' abilitie of life to thanke you:\n" +
    "He neuer gaue command'ment for their death.\n" +
    "But since so iumpe vpon this bloodie question,\n" +
    "You from the Polake warres, and you from England\n" +
    "Are heere arriued. Giue order that these bodies\n" +
    "High on a stage be placed to the view,\n" +
    "And let me speake to th' yet vnknowing world,\n" +
    "How these things came about. So shall you heare\n" +
    "Of carnall, bloudie, and vnnaturall acts,\n" +
    "Of accidentall iudgements, casuall slaughters\n" +
    "Of death's put on by cunning, and forc'd cause,\n" +
    "And in this vpshot, purposes mistooke,\n" +
    "Falne on the Inuentors head. All this can I\n" +
    "Truly deliuer";

function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint16Array(buf));
}


function testbarechachaEncrypt(iv, key){
    let ic = new iCrypto();
    let sharedKey = chat.session.metadata.sharedKey;

}

function testbarechachaDecrypt(iv, key){

}

function testChacha(txt, bufferSize = 4){
    let ic = new iCrypto();
    let sharedKey = chat.session.metadata.sharedKey;
    let cipher = new ArrayBuffer(0);
    let offset = 0;


    let iv;

    ic.ssym.init("enc", sharedKey, true);

    console.log("Encryptor initialized");
    while (offset< txt.length){
        let upperBound = Math.min(txt.length, offset+bufferSize);
        console.log("ENCRYPTION: Processing " + offset + ", " + upperBound);
        cipher = iCrypto.concatArrayBuffers(cipher, ic.ssym.encrypt("enc", txt.substring(offset, upperBound)))
        offset = upperBound;
    }

    let strcipher = ab2str(cipher);
    console.log("Encryption completed. Length encrypted: "  + strcipher.length + " | Length unencrypted: " + txt.length);


    let decipher = new ArrayBuffer(0);

    ic.ssym.init("dec", sharedKey, false);
    offset = 0;
    while (offset< cipher.byteLength){
        let upperBound = Math.min(cipher.byteLength, offset+bufferSize);
        console.log("DECRYPTION: Processing " + offset  + ", " + upperBound);
        decipher = iCrypto.concatArrayBuffers(decipher, ic.ssym.decrypt("dec", cipher.slice(offset, upperBound)))
        offset = upperBound;
    }

    let decipherStinrg = ab2str(decipher);
    console.log("decipher completed result: " + (decipherStinrg === txt));



}


function arrayBuffersEqual(buf1, buf2){
    let a1 = new Uint8Array(buf1)
    let a2 = new Uint8Array(buf2)

    if (a1.length !== a2.length){
        return false
    }

    for(let i in a1){
        if (a1[i] !== a2[i]){
            return false
        }
    }
    return true
}

function testChachaFile(file, bufferSize = 4){
    let ic = new iCrypto();
    let sharedKey = chat.session.metadata.sharedKey;
    let cipher = new ArrayBuffer(0);
    let offset = 0;


    let iv;

    ic.ssym.init("enc", sharedKey, true);

    console.log("Encryptor initialized");
    while (offset< file.byteLength){
        let upperBound = Math.min(file.byteLength, offset+bufferSize);
        console.log("ENCRYPTION: Processing " + offset + ", " + upperBound);
        cipher = iCrypto.concatArrayBuffers(cipher, ic.ssym.encrypt("enc", file.slice(offset, upperBound)));
        offset = upperBound;
    }

  //  let strcipher = ab2str(cipher);
    //console.log("Encryption completed. Length encrypted: "  + strcipher.length + " | Length unencrypted: " + txt.length);


    let decipher = new ArrayBuffer(0);

    ic.ssym.init("dec", sharedKey, false);
    offset = 0;
    while (offset< cipher.byteLength){
        let upperBound = Math.min(cipher.byteLength, offset+bufferSize);
        console.log("DECRYPTION: Processing " + offset  + ", " + upperBound);
        decipher = iCrypto.concatArrayBuffers(decipher, ic.ssym.decrypt("dec", cipher.slice(offset, upperBound)))
        offset = upperBound;
    }

   // let decipherStinrg = ab2str(decipher);
    console.log("decipher completed result: " + arrayBuffersEqual(decipher, file));

}


function testHashString (txt){
    let bufferSize = 4;
    let offset = 0;

    let hash = forge.md.sha256.create();
    let hashChunked = forge.md.sha256.create();
    let wholeBlob = txt;
    hash.update(wholeBlob);
    let hashRes = hash.digest().toHex();

    while(offset < txt.length){
        console.log("Updating hash with " + (offset) + ", " + (offset + bufferSize));
        let chunk = txt.substring(offset, Math.min(offset+bufferSize, txt.length))
        console.log(chunk);
        hashChunked.update(chunk);
        offset = Math.min(offset+bufferSize, txt.length)
    }

    let chunkedHashRes = hashChunked.digest().toHex();

    console.log("Hash of whole txt: " + hashRes + "\nHash of chunked: " + chunkedHashRes);
};


// file = document.querySelector('#attach-file').files[0]
//
// testHash(file);



////DEBUG TESTING////


function fileUploadTester(file){
    return new Promise((resolve, reject)=>{
        let self = chat;
        self.establishIslandConnection("file")
            .then(()=>{
                let reader = new FileReader()
                reader.readAsArrayBuffer(file);

                reader.onload = (ev)=>{
                    let bufferSize = 65536;
                    let offset = 0;
                    console.log("Connection established. Creating stream..");
                    let stream = ss.createStream();
                    ss(self.fileSocket).emit('file', stream, {
                        name: file.name,
                        size: file.size,
                        pkfp: self.session.publicKeyFingerprint
                    })

                    let ic = new iCrypto;
                    ic.addBlob("b", reader.result.toString())
                        .hash("b", "bh");

                    ic.createHash("h2")
                        .setSYMKey("sym", self.session.metadata.sharedKey);


                    while(offset < reader.result.byteLength){

                        console.log("Writing to stream bytes " + offset + ", " + offset + bufferSize);
                        let chunk = reader.result.slice(offset, offset+bufferSize)
                        let b = new ss.Buffer(chunk);
                        ic.updateHash("h2", chunk.toString());
                        stream.write(b);
                        offset += bufferSize
                    }
                    ic.digestHash("h2", "h2res");
                    console.log("Hash of whole file: " + ic.get("bh") + "\nHash of chunks: " + ic.get("h2res"));
                    console.log("Done writing buffer");
                    resolve()
                };


                //ss.createBlobReadStream(file).pipe(stream)
            })
    })
}




function uploadAttachmentTest(msg){
    let sjclHash = null;
    let forgeHash = null;

    establishConnection()
        .then((socket)=> {
            console.log("Connection established");
            let file = msg[1];
            return getHash(file)
        })
        .then(res => {
            let file = msg[1];
            let hash = res[0];
            let forgeHash = res[1];
            let sjclchunked = res[2];
            sjclHash = res[2];
            console.log("sjcl hash extracted: " + sjclchunked);
            return getHashWithBinaryString(file)
        })
        .then(res =>{

            forgeHash = res[0];
            let icHash = res[1];
            let ic = new iCrypto();
            let reader = new FileReader;
            reader.onload = ()=>{
                console.log("File loaded successfully!");
                // ic.createHash("hhh")
                //     .updateHash("hhh", reader.result)
                //     .digestHash("hhh", "hhhr");
                //    let sjclFull = new sjcl.hash.sha256();

                //  let sjclArrBuff = sjcl.codec.bytes;
                //      sjclFull.update(reader.result);


                //let sjclFullRes = sjcl.codec.hex.fromBits(sjclFull.finalize());
                let fullForge = forge.md.sha256.create();
                let buffSize = 1024*128;
                let offset = 0;

                while (offset< reader.result.length){
                    let upperBound = Math.min(offset+buffSize, reader.result.length);
                    console.log("updating forge: " + offset + ",  " + upperBound);
                    fullForge.update(reader.result.substring(offset, upperBound));
                    offset = Math.min(offset+buffSize, reader.result.length);
                }

                let fulForgeRes = fullForge.digest().toHex();

                // ic.addBlob("ff", reader.result)
                //     .hash("ff", "ffh")
                // console.log("ic+forge chunk hash: " + hash + "\nic+full: " + ic.get("ffh") + "\nic+forge+full: "
                //     + ic.get("hhhr") + "\nForgeHash: " + forgeHash+
                // "\nFull forge: " + fulForgeRes +

                console.log("\nsjcl chunked: " + sjclchunked +
                    "\nfull forge res:  " + fulForgeRes)
            };
            //reader.readAsBinaryString(msg[1]);

            console.log("\nsjcl chunked: " + sjclHash +
                "\nfull forge res:  " + forgeHash +
                "\nic hash: " + icHash);

            console.log("Worker Initialized!");
        })
}



function getHashWithBinaryString(file){
    return new Promise((resolve, reject)=>{
        console.log("Exctracting hash");
        let offset = 0;
        let fileSize = file.size;
        let bufferSize = 1024 * 128;
        let hash  = forge.md.sha256.create();
        let sjclCipher = new sjcl.hash.sha256();
        let ic = new iCrypto();
        ic.createHash("h");

        let errorEventHandler = (ev)=>{
            console.log("Read error: " + ev.target.error);
        };

        let readEventHandler = (ev)=>{
            if(ev.target.error === null){
                offset = Math.min(offset + bufferSize, fileSize);
                handleBlock(ev.target.result);
            } else {
                console.log("Read error: " + ev.target.error);
                return;
            }
            if(offset >= fileSize){
                console.log("Done reading file");
                //ic.digestHash("h", "hh");
                let f = hash.digest().toHex();
                ic.digestHash("h", "hres");
                resolve([f, ic.get("hres")]);
                return;
            }
            chunkReaderBlock(offset, bufferSize, file)
        };

        let chunkReaderBlock = (_offset, bufferSize, _file)=>{
            let reader = new FileReader();
            let blob = _file.slice(_offset, Math.min(_offset + bufferSize, fileSize));
            reader.onload = readEventHandler;
            reader.onerror = errorEventHandler;
            reader.readAsBinaryString(blob);
        };
        let handleBlock = (blob)=>{
            let upperBound = Math.min(offset + bufferSize, fileSize)
            console.log("updating hash: " + offset +", " +  upperBound + " | Filesize: " + fileSize);
            ic.updateHash("h", blob);
            hash.update(blob);


        };

        chunkReaderBlock(offset, bufferSize, file)
    })


}
