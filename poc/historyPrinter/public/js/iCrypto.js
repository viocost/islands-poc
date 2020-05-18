'use strict';

class iCryptoFactory{

    constructor(settings){
        this.readSettings();
    }

    createICryptor(){
        return new iCrypto(this.settings);
    }

    readSettings(){
        console.log("readubg settings");
        this.settings = null;
    }
}



class iCrypto {
    constructor(settings){
        let self = this;
        self.settings = {};
        self.locked = false;
        self.setEncodersAndDecoders();
        self.symCiphers = ['aes'];
        self.streamCiphers = ['chacha'];
        self.asymCiphers = ['rsa'];
        self.store = {}

        self.rsa = {
            createKeyPair: (...args)=>{ return self.generateRSAKeyPair(...args)},
            asyncCreateKeyPair: (...args)=>{return self.asyncGenerateRSAKeyPair(...args)},
            encrypt: (...args)=>{return self.publicKeyEncrypt(...args)},
            decrypt: (...args)=>{return self.privateKeyDecrypt(...args)},
            sign: (...args)=>{return self.privateKeySign(...args)},
            verify: (...args)=>{return self.publicKeyVerify(...args)},
            setKey: (...args)=>{return self.setRSAKey(...args)},
            getSettings: ()=>{return "RSA"}
        };

        self.aes = {
            modes: ['CBC', 'CFB', 'CTR'],
            mode: 'CBC',
            ivLength: 16,
            keySize: 32,
            createKey: (...args)=>{return self.createSYMKey(...args)},
            encrypt: (...args)=>{return self.AESEncrypt(...args)},
            decrypt: (...args)=>{return self.AESDecrypt(...args)},
            setKey: (...args)=>{return self.setSYMKey(...args)},
            getSettings: ()=>{return "AES"}
        };

        self.chacha = {
            init: (...args)=>{return self.initStreamCryptor(...args)},
            encrypt: (...args)=>{return self.streamCryptorEncrypt(...args)},
            decrypt: (...args)=>{return self.streamCryptorDecrypt(...args)},
            getSettings: ()=>{return "ChaCha"}
        };

        self.setAsymCipher('rsa');
        self.setSymCipher('aes');
        self.setStreamCipher('chacha');


    }


    /***************** SETTING CIPHERS API *******************/


    setSymCipher(...opts){
        let self = this;
        if (!self.symCiphers.includes(opts[0])){
            throw "setSymCipher: Invalid or unsupported algorithm"
        }
        self.sym = self[opts[0]]
    }

    setAsymCipher(...opts){
        let self = this;
        if (!self.asymCiphers.includes(opts[0])){
            throw "setSymCipher: Invalid or unsupported algorithm"
        }
        self.asym = self[opts[0]]
    }

    setStreamCipher(...opts){
        let self = this;
        if (!self.streamCiphers.includes(opts[0])){
            throw "setSymCipher: Invalid or unsupported algorithm"
        }
        self.ssym = self[opts[0]]
    }



    /***************** END **********************************/


    setEncodersAndDecoders(){
        this.encoders = {
            hex: iCrypto.hexEncode,
            base64: iCrypto.base64Encode
        };

        this.decoders = {
            hex: iCrypto.hexDecode,
            base64: iCrypto.base64Decode
        };
    }


    /*********MAIN METHODS**************/

    /**********************$$*****************************/
    /***####NONCES PLAIN TEXT####***/

    asyncCreateNonce(nameToSave, length=32){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.createNonce(nameToSave, length))
            } catch (err){
                reject(err)
            }
        })
    }

    /**
     * Creates nonce of the given length and
     * saves it under the provided name.
     * Default is 32 bytes
     *
     * @param {string} nameToSave
     * @param {number} length
     * @returns {iCrypto}
     */
    createNonce(nameToSave = iCrypto.pRequired("createNonce"), length=32){
        let self = this;
        this.set(nameToSave, iCrypto.getBytes(length));
        return this;
    }




    asyncAddBlob(nameToSave, plainText){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.addBlob(nameToSave, plainText));
            } catch (err){
                reject(err);
            }
        })
    }

    addBlob(nameToSave = iCrypto.pRequired("addBlob"), plainText = iCrypto.pRequired("addBlob")){
        this.set(nameToSave, plainText.toString().trim());
        return this
    }


    /**********************$$*****************************/
    /***#### KEYS CRYPTO ####***/

    asyncCreateSYMKey(nameToSave, ivLength=16, keyLength=32){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.createSYMKey(nameToSave, ivLength, keyLength));
            } catch (err){
                reject(err);
            }
        })
    }



    /**
     * Creates hex-encoded SYM key, which is just some random hex-encoded bytes
     * @param nameToSave
     * @param keyLength
     * @returns {iCrypto}
     */
    createSYMKey(nameToSave = iCrypto.pRequired("createSYMKey"), keyLength=32){
        let self = this;
        let key = iCrypto.getBytes(keyLength);
        self.set(nameToSave, forge.util.bytesToHex(key));
        return self;
    }

    /**
     * Sets passed SYM key inside the object
     * @param nameToSave
     * @param {string} key Must be hexified string
     */
    setSYMKey(nameToSave =  iCrypto.pRequired("setSYMKey"),
              key = iCrypto.pRequired("setSYMKey")){
        this.set(nameToSave, key);
        return this;
    }

    /**
     * requires object of similar structure for key as being created by createSYMKey
     * @param target
     * @param key
     * @param nameToSave
     * @returns {Promise}
     */
    asyncAESEncrypt(target, key, nameToSave, hexify, mode, encoding ){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.AESEncrypt(target, key, nameToSave, hexify, mode, encoding));
            } catch (err){
                reject(err);
            }
        })
    }

    /**
     * Encrypts blob identified by "target" parameter.
     * Target must be set inside iCrypto object
     * IV is randomly generated and appended to the cipher blob
     * @param {string} target
     * @param {string} key
     * @param {string} nameToSave
     * @param {boolean} hexify - Specifies the encoding of the resulting cipher. Default: hex.
     * @param {string} mode - specifies AES mode. Default - CBC
     * @param {number} ivLength - specifies length of initialization vector
     *  The initialization vector of specified length will be generated and
     *  appended to the end of resulting cipher. IV blob will be encoded according to
     *  outputEncoding parameter, and its length will be last 3 bytes of the cipher string.
     *
     */
    AESEncrypt(target = iCrypto.pRequired("AESEncrypt"),
               key = iCrypto.pRequired("AESEncrypt"),
               nameToSave = iCrypto.pRequired("AESEncrypt"),
               hexify = true,
               mode = 'CBC',
               encoding){

        let self = this;
        if(!self.aes.modes.includes(mode.toUpperCase())){
            throw "AESencrypt: Invalid AES mode";
        }
        mode = "AES-" + mode.toUpperCase();
        //Creating random 16 bytes IV
        const iv = iCrypto.getBytes(16);
        let AESkey = forge.util.hexToBytes(self.get(key));
        const cipher = forge.cipher.createCipher(mode, AESkey);
        cipher.start({iv:iv});
        cipher.update(forge.util.createBuffer(this.get(target), encoding));
        cipher.finish();
        this.set(nameToSave, (hexify ? forge.util.bytesToHex(iv) + cipher.output.toHex():
                                       iv + cipher.output));
        return this;
    }


    asyncAESDecrypt(target, key, nameToSave){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.AESDecrypt(target, key, nameToSave));
            } catch (err){
                reject(err);
            }
        })
    }

    /**
     * Decrypts the blob loaded into iCrypto object and specified by targe parameter
     * Assumes that initialization vector is PREPENDED to the cipher text
     * and its length is 16 bytes
     *
     * @param {string} target - ciphertext within iCrypto object
     * @param {string} key - Symmetric AES key in form of hex string
     * @param {string} nameToSave
     * @param {boolean} dehexify
     * @param {string} mode AES mode
     * @param {string} encoding - resulting plain text encoding default (UTF8)
     */
    AESDecrypt(target = iCrypto.pRequired("AESDecrypt"),
               key = iCrypto.pRequired("AESDecrypt"),
               nameToSave = iCrypto.pRequired("AESDecrypt"),
               dehexify = false,
               mode = "CBC",
               encoding){
        let self = this;
        let cipherWOIV;
        if(!self.aes.modes.includes(mode.toUpperCase())){
            throw "AESencrypt: Invalid AES mode";
        }
        mode = "AES-" + mode.toUpperCase();
        let cipher = self.get(target);
        let iv;
        if(dehexify){
            iv = forge.util.hexToBytes(cipher.substring(0, 32));
            cipherWOIV = forge.util.hexToBytes(cipher.substr(32));
        } else{
            //Assuming cipher is a binary string
            cipherWOIV = cipher.substr(16);
            iv = cipher.substring(0, 16);
        }
        const AESkey = forge.util.hexToBytes(this.get(key));
        let decipher = forge.cipher.createDecipher(mode, AESkey);
        decipher.start({iv:iv});
        decipher.update(forge.util.createBuffer(cipherWOIV));
        decipher.finish();
        this.set(nameToSave, decipher.output.toString('utf8'));
        return this;
    }

    asyncHash(target, nameToSave, algorithm = "sha256"){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.hash(target, nameToSave, algorithm));
            } catch (err){
                reject(err);
            }
        })
    }

    /**
     * This function meant to be used on large files
     * It is asynchronous, uses web workers,
     * and it calculates hash of a large file without loading it
     * fully into memory
     * @param file  -  value of an input of type file
     * @param nameToSave - name to store resulting hash
     * @param algorithm - sha256 is default
     */
    hashFileWorker(file = iCrypto.pRequired("fileHashWorker file"),
                   nameToSave = iCrypto.pRequired("fileHashWorker nameToSave"),
                   algorithm = "sha256"){
        return new Promise((resolve, reject)=>{
            let self = this;
            if(Worker === undefined){
                throw "Web workers are not supported in current environment";
            }
            let worker = new Worker("/js/iCryptoWorker.js");
            worker.onmessage = (ev) =>{
                if (ev.data[0] === "success"){
                    self.set(nameToSave, ev.data[1]);
                    resolve(self);
                    worker.terminate();
                } else{
                    reject(ev.data[1]);
                    worker.terminate();
                }
            };
            worker.postMessage(["hashFile", file]);
        })
    }

    /**
     * Initializes stream encryptor or decryptor
     *
     * Supported algorithm is chacha20 only
     * Single instance of a single stream cryptor can be used
     * only one time, one way, and only for a single stream.
     * Meaning you can take a single stream and encrypt it chunk by chunk,
     * but then, if you want to decrypt the stream,  you have to
     * re-initialize cryptor instance or use a new one,
     * otherwise the output will be meaningless.
     *
     * All the chunks must flow in sequence.
     *
     * !!!Important
     *
     * Encryption:
     * Stream cryptor handles initialization vector (iv)
     * by prepending them to cipher. So, to encrypt the data -
     * just pass the key and new iv will be created automatically
     * and prepended to the cipher
     *
     * Decryption:
     * On Decryption the algorithm ASSUMES that first 6 bytes of
     * the ciphertext is iv.
     * So, it will treat first 6 bytes as iv regardles of chunks,
     * and will begin decryption starting from byte 7
     *
     * @param {String} nameToSave - Stream cryptor will be saved inside iCrypto instance
     * @param {String} key String of bytes in hex - Symmetric key used to encrypt/decrypt data
     *  The algorithm requires key to be 32 bytes precisely
        Only first 32 bytes (after decoding hex) will be taken
     * @param {Boolean} isEncryptionMode - flag encryption mode - true
     * @param {String} algorithm Supports only chacha20 for now
     */
    initStreamCryptor(nameToSave =iCrypto.pRequired("initStreamEncryptor"),
                      key = iCrypto.pRequired("initStreamEncryptor"),
                      isEncryptionMode = true,
                      algorithm = "chacha20"){
        let self  = this;
        let ivRaw, ivHex, keyRaw, cryptor, ivBuffer;
        let mode = "enc";

        keyRaw = iCrypto.hexDecode(key);
        if (keyRaw.length < 16){
            throw "chacha20: invalid key size: " + keyRaw.length + " key length must be 32 bytes";
        }

        let keyBuffer = iCrypto.stringToArrayBuffer(keyRaw).slice(0, 32);


        if (isEncryptionMode){
            ivRaw = iCrypto.getBytes(6)
            ivHex = iCrypto.hexEncode(ivRaw);
            ivBuffer = iCrypto.stringToArrayBuffer(ivRaw).slice(0, 12);
            cryptor = new JSChaCha20(new Uint8Array(keyBuffer), new Uint8Array(ivBuffer), 0)
        } else {
            mode = "dec";
            ivBuffer = new ArrayBuffer(0);
        }

        let res = new function (){
            let self = this;
            self.cryptor= cryptor;
            self.key =  key;
            self.iv = ivHex;
            self.mode = mode;
            self.encryptionMode =  ()=>{
                return self.mode === "enc"
            };
            self.decryptionMode = ()=>{
                return self.mode === "dec"
            };
            self.encrypt = (input)=>{
                let blob = (typeof(input) === "string") ? iCrypto.stringToArrayBuffer(input) : input;
                if (!blob instanceof ArrayBuffer && !blob instanceof Uint8Array){
                    throw "StreamCryptor encrypt: input type is invalid";
                }
                if (self.cryptor._byteCounter === 0){
                    //First check if counter is 0.
                    //If so - it is a first encryption block and we need to prepend IV
                    let encrypted = self.cryptor.encrypt(new Uint8Array(blob));
                    return iCrypto.concatUint8Arrays(new Uint8Array(ivBuffer), encrypted)
                } else{
                    //Just encrypting the blob
                    return self.cryptor.encrypt(new Uint8Array(blob));
                }
            };

            self.decrypt = (input)=>{
                let blob = (typeof(input) === "string") ? iCrypto.stringToArrayBuffer(input) : input;
                if (!blob instanceof ArrayBuffer){
                    throw "StreamCryptor encrypt: input type is invalid";
                }

                if (self.cryptor === undefined){
                    //decryptor was not initialized yet because
                    //Initalization vecotor (iv)was not yet obtained
                    //IV assumed to be first 6 bytes prepended to cipher
                    let currentIVLength = ivBuffer.byteLength;
                    if (currentIVLength + blob.byteLength <= 12){
                        ivBuffer = iCrypto.concatArrayBuffers(ivBuffer, blob);
                        //Still gathering iv, so returning empty array
                        return new Uint8Array();
                    } else{
                        let remainingIVBytes = 12-ivBuffer.byteLength;
                        ivBuffer = iCrypto.concatArrayBuffers(ivBuffer, blob.slice(0, remainingIVBytes));
                        self.iv = iCrypto.hexEncode(iCrypto.arrayBufferToString(ivBuffer));
                        self.cryptor = new JSChaCha20(new Uint8Array(keyBuffer), new Uint8Array(ivBuffer), 0);
                        let chunk = new Uint8Array(blob.slice(remainingIVBytes, blob.byteLength));
                        return self.cryptor.decrypt(chunk);
                    }
                } else {
                    //Decrypto is initialized.
                    // Just decrypting the blob and returning result
                    return self.cryptor.decrypt(new Uint8Array(blob));
                }

            }
        };
        self.set(nameToSave, res);
        return self;
    }

    streamCryptorGetIV(target = iCrypto.pRequired("streamCryptorGetIV")){
        let self = this;
        let cryptor = self.get(target);
        return cryptor.iv;
    }

    streamCryptorEncrypt(cryptorID = iCrypto.pRequired("streamCryptorEncrypt"),
             blob = iCrypto.pRequired("streamCryptorEncrypt"),
             encoding = "raw"){
        let self = this;
        let input;
        let cryptor = self.get(cryptorID);
        if (!cryptor.encryptionMode()){
            throw "streamCryptorEncrypt error: mode is invalid";
        }

        if (blob instanceof ArrayBuffer){
            input = blob
        } else if (blob instanceof Uint8Array){
            input = blob.buffer
        } else if (typeof(blob) === "string"){
            input = iCrypto.stringToArrayBuffer(blob)
        } else{
            throw("streamCryptorEncrypt: invalid format input");
        }


        if (encoding === undefined || encoding === "raw"){
            return cryptor.encrypt(input).buffer
        } else {
            throw "NOT IMPLEMENTED"
        }


    }

    streamCryptorDecrypt(cryptorID = iCrypto.pRequired("streamCryptorEncrypt"),
                         blob = iCrypto.pRequired("streamCryptorEncrypt"),
                         encoding = "raw"){
        let self = this;
        let cryptor = self.get(cryptorID);

        let input;

        if (!cryptor.decryptionMode()){
            throw "streamCryptorEncrypt error: mode is invalid";
        }

        if (blob instanceof ArrayBuffer){
            input = blob
        } else if (blob instanceof Uint8Array){
            input = blob.buffer
        } else if (typeof(blob) === "string"){
            input = iCrypto.stringToArrayBuffer(blob)
        } else{
            throw("streamCryptorEncrypt: invalid format input");
        }
        if (encoding === undefined || encoding === "raw"){
            return cryptor.decrypt(input).buffer
        } else {
            throw "NOT IMPLEMENTED"
        }
    }




    /**
     *
     * @param target
     * @param nameToSave
     * @param algorithm
     */
    hash(target = iCrypto.pRequired("hash"),
         nameToSave  = iCrypto.pRequired("hash"),
         algorithm = "sha256"){
        let self = this;
        let blob = self.get(target);
        if(typeof(blob) !== "string"){
            throw "hash: invalid target type: " + typeof(blob) + "  Target must be string."
        }
        algorithm = algorithm.toLowerCase();
        let hash = forge.md.hasOwnProperty(algorithm) ? forge.md[algorithm].create(): this.throwError("Wrong hash algorithm");

        hash.update(blob);
        this.set(nameToSave, hash.digest().toHex());
        return self
    }


    createHash(nameToSave = iCrypto.pRequired("createHash"),
               algorithm = "sha256"){
        let hash = sjcl.hash.hasOwnProperty(algorithm) ? new sjcl.hash[algorithm](): this.throwError("Wrong hash algorithm");
        this.set(nameToSave, hash);
        return this
    }

    /**
     *
     * @param target
     * @param {} blob can be binary string or arrayBuffer
     * @returns {iCrypto}
     */
    updateHash(target = iCrypto.pRequired("updateHash: target"), blob = iCrypto.pRequired("updateHash: blob")){
        let self = this;
        let input;
        if (typeof(blob) === "string"){
            input = iCrypto.stringToArrayBuffer(blob)
        } else if (blob instanceof Uint8Array){
            input = blob.buffer;
        } else if (blob instanceof ArrayBuffer){
            input = blob
        } else{
            throw "invalid input format!"
        }
        let hash = self.get(target);
        hash.update(sjcl.codec.arrayBuffer.toBits(input));
        return self
    }

    digestHash(target = iCrypto.pRequired("digestHash",),
               nameToSave = iCrypto.pRequired("digestHash"),
               hexify = true){
        let self = this;
        let hRes = self.get(target);
        let res = hexify ? sjcl.codec.hex.fromBits(hRes.finalize())
            : sjcl.codec.arrayBuffer.fromBits(hRes.finalize());
        this.set(nameToSave,  res);
        return self;
    }


    asyncGenerateRSAKeyPair(nameToSave = iCrypto.pRequired("asyncGenerateRSAKeyPair"),
                            length = 2048){
        return new Promise((resolve, reject)=>{
            let self = this;
            forge.rsa.generateKeyPair({bits: length, workers: -1}, (err, pair)=> {
                if (err)
                    reject(err);
                else{
                    try{

                        let pubKey =  forge.pki.publicKeyToPem(pair.publicKey);
                        let privKey = forge.pki.privateKeyToPem(pair.privateKey);
                        self.set(nameToSave, {
                            publicKey: pubKey,
                            privateKey: privKey,
                        });
                        resolve(this);

                    } catch(err){

                        reject(err);

                    }
                }
            });
        })
    }


    /**
     * Generates RSA key pair.
     * Key saved in PEM format
     * resulting object has publicKey, privateKey, keyType, length
     * @param nameToSave
     * @param length
     * @returns {iCrypto}
     */
    generateRSAKeyPair(nameToSave = iCrypto.pRequired("generateRSAKeyPair"), length = 2048){
        let self = this;
        let pair = forge.pki.rsa.generateKeyPair({bits: length, e: 0x10001});
        let pubKey =  forge.pki.publicKeyToPem(pair.publicKey);
        let privKey = forge.pki.privateKeyToPem(pair.privateKey);

        self.set(nameToSave, {
            publicKey: pubKey,
            privateKey: privKey,
        });
        return self;
    }

    /**
     * Takes previously saved RSA private key in PEM format,
     * extracts its public key
     * and saves it in PEM format under the name specified
     * @param target
     * @param nameToSave
     * @returns {iCrypto}
     */
    publicFromPrivate(target = iCrypto.pRequired("publicFromPrivate"),
                      nameToSave = iCrypto.pRequired("publicFromPrivate")){
        let forgePrivateKey = forge.pki.privateKeyFromPem(this.get(target));
        this.set(nameToSave, forge.pki.publicKeyToPem(forgePrivateKey));
        return this;
    }

    /**
     * Accepts as an input RSA key and saves it inside an object under the name specified.
     * Key must be provided either in PEM or in raw base64.
     * @param {String} nameToSave
     * @param {String} keyData: public or private RSA key either in raw base64 or PEM format
     * @param {String} type: must be either "public" or "private"
     *
     * @returns {iCrypto}
     */
    setRSAKey(nameToSave = iCrypto.pRequired("setRSAPublicKey"),
              keyData = iCrypto.pRequired("setRSAPublicKey"),
              type = iCrypto.pRequired("setRSAPublicKey")){
        if (type!== "public" && type !== "private"){
            throw "Invalid key type"
        }

        if (!iCrypto.isRSAPEMValid(keyData, type)){
            keyData = iCrypto.base64ToPEM(keyData, type);
        }
        type === "public" ? forge.pki.publicKeyFromPem(keyData) : forge.pki.privateKeyFromPem(keyData);
        this.set(nameToSave, keyData);
        return this;
    }

    /**
     * For internal use only. Takes key data in form of a string
     * and checks whether it matches RSA PEM key format
     * @param {string} keyData
     * @param {string}type ENUM "public", "private"
     * @returns {boolean}
     */
    static isRSAPEMValid(keyData, type){
        keyData = keyData.trim();
        let headerPattern = (type === "public" ? /^-{4,5}BEGIN.*PUBLIC.*KEY.*-{4,5}/ : /^-{4,5}BEGIN.*PRIVATE.*KEY.*-{4,5}/);
        let footerPattern = (type === "public" ? /^-{4,5}END.*PUBLIC.*KEY.*-{4,5}/ : /^-{4,5}END.*PRIVATE.*KEY.*-{4,5}/);
        let valid = true;
        keyData = keyData.replace(/\r?\n$/, "");
        let keyDataArr = keyData.split(/\r?\n/);
        valid = (valid &&
            keyDataArr.length>2 &&
            headerPattern.test(keyDataArr[0]) &&
            footerPattern.test(keyDataArr[keyDataArr.length -1])
        );
        return valid;
    }

    static base64ToPEM(keyData, type){
        let header = type === "public" ? "-----BEGIN PUBLIC KEY-----" : "-----BEGIN RSA PRIVATE KEY-----";
        let footer = type === "public" ? "-----END PUBLIC KEY-----" : "-----END RSA PRIVATE KEY-----";
        let result = header;
        for (let i = 0; i<keyData.length; ++i){
            result += (i%64===0 ? "\r\n" + keyData[i] : keyData[i])
        }
        result += "\r\n" + footer;
        return result;
    }

    asyncPublicKeyEncrypt(target, keyPair, nameToSave, encoding){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.publicKeyEncrypt(target, keyPair, nameToSave))
            } catch (err){
                reject(err);
            }

        })
    }


    /**
     * creates and saves public key fingerprint
     * @param target - public key, either keypair or public key
     * @param nameToSave
     * @param hashAlgorithm
     * @returns {iCrypto}
     */
    getPublicKeyFingerprint(target = iCrypto.pRequired("getPublicKeyFingerpint"),
                            nameToSave =  iCrypto.pRequired("getPublicKeyFingerpint"),
                            hashAlgorithm = "sha256"){
        let key = this.validateExtractRSAKey(this.get(target), "public");
        let forgeKey = forge.pki.publicKeyFromPem(key);
        let fingerprint = forge.pki.getPublicKeyFingerprint(forgeKey, {encoding: 'hex', md: forge.md[hashAlgorithm].create()});
        this.set(nameToSave, fingerprint);
        return this;
    }

    publicKeyEncrypt(target = iCrypto.pRequired("publicKeyEncrypt"),
                     key = iCrypto.pRequired("publicKeyEncrypt"),
                     nameToSave = iCrypto.pRequired("publicKeyEncrypt"),
                     encoding){
        key = this.validateExtractRSAKey(this.get(key), "public");
        let publicKey = forge.pki.publicKeyFromPem(key);
        let result = publicKey.encrypt(this.get(target));
        if (encoding){
            result = this._encodeBlob(result, encoding)
        }
        this.set(nameToSave, result);
        return this;
    }

    /**
     * For internal use. Encode the blob in format specified
     * @param blob
     * @param encoding
     * @private
     */
    _encodeBlob(blob = iCrypto.pRequired("_encodeBlob"),
                encoding = iCrypto.pRequired("_encodeBlob")){
        let self = this;
        if (!this.encoders.hasOwnProperty(encoding)){
            throw "_encodeBlob: Invalid encoding: " + encoding;
        }
        return self.encoders[encoding](blob)
    }

    _decodeBlob(blob = iCrypto.pRequired("_encodeBlob"),
                encoding = iCrypto.pRequired("_encodeBlob")){

        let self = this;
        if (!this.encoders.hasOwnProperty(encoding)){
            throw "_decodeBlob: Invalid encoding: " + encoding;
        }
        return this.decoders[encoding](blob)
    }


    asyncPrivateKeyDecrypt(target, key, nameToSave){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.privateKeyDecrypt(target, key, nameToSave))
            }catch(err){
                reject(err);
            }
        })
    }

    privateKeyDecrypt(target = iCrypto.pRequired("privateKeyDecrypt"),
                      key = iCrypto.pRequired("privateKeyDecrypt"),
                      nameToSave = iCrypto.pRequired("privateKeyDecrypt"),
                      encoding){

        key = this.validateExtractRSAKey(this.get(key), "private");
        let privateKey = forge.pki.privateKeyFromPem(key);
        let cipher = this.get(target);
        if (encoding){
            cipher = this._decodeBlob(cipher, encoding);
        }
        this.set(nameToSave, privateKey.decrypt(cipher));
        return this;
    }


    asyncPrivateKeySign(target, keyPair, nameToSave){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.privateKeySign(target, keyPair, nameToSave));
            } catch(err){
                reject(err);
            }
        })
    }

    privateKeySign(target = iCrypto.pRequired("privateKeyEncrypt"),
                   key = iCrypto.pRequired("privateKeyEncrypt"),
                   nameToSave = iCrypto.pRequired("privateKeyEncrypt"),
                   hashAlgorithm = "sha256",
                   hexifySign = true){
        key = this.validateExtractRSAKey(this.get(key), "private");
        const privateKey = forge.pki.privateKeyFromPem(key);
        const md = forge.md[hashAlgorithm].create();
        md.update(this.get(target));
        let signature = privateKey.sign(md);
        signature = hexifySign ? forge.util.bytesToHex(signature) : signature;
        this.set(nameToSave, signature);
        return this;
    }


    asyncPublicKeyVerify(target, signature, key, nameToSave){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.publicKeyVerify(target, signature, key, nameToSave));
            } catch(err){
                reject(err);
            }
        })
    }

    publicKeyVerify(target = iCrypto.pRequired("publicKeyVerify"),
                    signature = iCrypto.pRequired("publicKeyVerify"),
                    key = iCrypto.pRequired("publicKeyVerify"),
                    nameToSave = iCrypto.pRequired("publicKeyVerify"),
                    dehexifySignRequired = true){
        key = this.validateExtractRSAKey(this.get(key), "public");
        let publicKey = forge.pki.publicKeyFromPem(key);
        const md = forge.md.sha256.create();
        md.update(this.get(target));
        let sign = this.get(signature);
        sign = dehexifySignRequired ? forge.util.hexToBytes(sign) : sign;
        const verified = publicKey.verify(md.digest().bytes(), sign);
        this.set(nameToSave, verified);
        return this;
    }

    /**
     * Validates and extracts RSA key from either keypair
     * or separate private or public keys saved previously within the object.
     * Checks PEM structure and returns requested key in PEM format
     * or throws error if something wrong
     * @param key - target key
     * @param type - "public" or "private"
     * @return public or private key in PEM format
     */
    validateExtractRSAKey(key = iCrypto.pRequired("validateAndExtractRSAKey"),
                          keyType = iCrypto.pRequired("validateAndExtractRSAKey")){
        const keyTypes = {public: "publicKey", private: "privateKey"};
        if (!Object.keys(keyTypes).includes(keyType))
            throw "validateExtractRSAKey: key type is invalid!";
        if (key[keyTypes[keyType]]){
            key = key[keyTypes[keyType]];
        }
        if (!iCrypto.isRSAPEMValid(key, keyType)){
            console.log(keyType);
            console.log(key);
            throw "validateExtractRSAKey: Invalid key format"
        }
        return key;
    }

    pemToBase64(target = iCrypto.pRequired("pemToBase64"),
                nameToSave = iCrypto.pRequired("pemToBase64"),
                keyType = iCrypto.pRequired("pemToBase64")){
        let key = this.get(target);
        if (!iCrypto.isRSAPEMValid(key, keyType)){
            console.log(keyType);
            console.log(key);
            throw "validateExtractRSAKey: Invalid key format"
        }
        key = key.trim().split(/\r?\n/).slice(1, -1).join("");
        this.set(nameToSave, key);
    }


    /***#### COMPRESSION ####***/

    asyncCompress(target, nameToSave){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.compress(target, nameToSave));
            } catch(err){
                reject(err);
            }
        })
    }

    /**
     * Compresses data under key name
     * @param target
     *  type: String
     *  Key to data that needed to be compressed
     * @param nameToSave
     *  type: String
     *  if passed - function will save the result of compression under this key
     *  otherwise the compression will happen in-place
     */
    compress(target = iCrypto.pRequired("compress"), nameToSave = iCrypto.pRequired("compress")){
        let compressed = LZMA.compress(this.get(target));
        this.set(nameToSave, compressed);
        return this;
    }

    asyncDecompress(target, nameToSave){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.decompress(target, nameToSave));
            } catch(err){
                reject(err);
            }

        })
    }

    /**
     * Decompresses data under key name
     * @param target
     *  type: String
     *  Key to data that needed to be compressed
     * @param nameToSave
     *  type: String
     *  if passed - function will save the result of compression under this key
     *  otherwise decompression will happen in-place
     */
    decompress(target = iCrypto.pRequired("decompress"),
               nameToSave = iCrypto.pRequired("decompress")){
        let decompressed = LZMA.decompress(this.get(target));
        this.set(nameToSave, decompressed);
        return this;
    }


    /***#### UTILS ####***/

    encode(target = iCrypto.pRequired("encode"),
           encoding = iCrypto.pRequired("encode"),
           nameToSave = iCrypto.pRequired("encode")){
        let self = this;
        self.set(nameToSave, self._encodeBlob(this.get(target), encoding));
        return this;
    }





    base64Encode(name = iCrypto.pRequired("base64Encode"),
                 nameToSave = iCrypto.pRequired("base64Encode"),
                 stringify = false){
        let target = stringify ? JSON.stringify(this.get(name)): this.get(name)
        this.set(nameToSave, iCrypto.base64Encode(target));
        return this;
    }

    base64Decode(name = iCrypto.pRequired("base64decode"),
                 nameToSave = iCrypto.pRequired("base64decode"),
                 jsonParse = false){
        let decoded = iCrypto.base64Decode(this.get(name));
        decoded = jsonParse ? JSON.parse(decoded) : decoded;
        this.set(nameToSave, decoded);
        return this;
    }

    /*
        base32Encode(name = this.pRequired("base32Encode"),
                     nameToSave = this.pRequired("base32Encode")){
            let base32 = new Base32();
            let encoded = base32.encode(this.get(name));
            this.set(nameToSave, encoded);
            return this;
        }


        base32Decode(name = this.pRequired("base64decode"),
                     nameToSave = this.pRequired("base64decode")){
            let base32 = new Base32();
            let decoded = base32.decode(this.get(name));
            this.set(nameToSave, decoded);
            return this;
        }
    /**/
    bytesToHex(name = iCrypto.pRequired("bytesToHex"),
               nameToSave = iCrypto.pRequired("bytesToHex"),
               stringify = false){
        let target = stringify ? JSON.stringify(this.get(name)): this.get(name)
        this.set(nameToSave, iCrypto.hexEncode(target));
        return this;
    }

    hexToBytes(name = iCrypto.pRequired("hexToBytes"),
               nameToSave = iCrypto.pRequired("hexToBytes"),
               jsonParse = false){
        let decoded = iCrypto.hexDecode(this.get(name));
        decoded = jsonParse ? JSON.parse(decoded) : decoded;
        this.set(nameToSave, decoded);
        return this;
    }

    stringifyJSON(name = iCrypto.pRequired("stringify"),
                  nameToSave = iCrypto.pRequired("stringify")){
        let target = this.get(name);
        if (typeof(target) !== "object"){
            throw "stringifyJSON: target invalid";
        }

        this.set(nameToSave, JSON.stringify(target));
        return this;
    }

    parseJSON(name = iCrypto.pRequired("stringify"),
              nameToSave = iCrypto.pRequired("stringify")){
        let target = this.get(name);
        if (typeof(target) !== "string"){
            throw "stringifyJSON: target invalid";
        }
        this.set(nameToSave, JSON.parse(target))
        return this;
    }

    /**
     * Merges elements into a single string
     * if name passed - saves the merge result inside the object
     * under key <name>.
     * @param things
     *     type: array
     *     array of strings. Each string is a key.
     * @param name
     *     type: string
     *     name of the key under which to save the merge result
     */
    merge(things = iCrypto.pRequired("merge"), nameToSave  = iCrypto.pRequired("merge")){

        if (!this.keysExist(things))
            throw "merge: some or all objects with such keys not found ";

        console.log("Mergin' things");
        let result = "";
        for (let i= 0; i< things.length; ++i){
            let candidate = this.get(things[i]);
            if (typeof (candidate) === "string" || typeof(candidate) ==="number" )
                result += candidate;
            else
                throw "Object " + things[i] + " is not mergeable";
        }
        this.set(nameToSave, result);
        return this;
    }

    encodeBlobLength(target = iCrypto.pRequired("encodeBlobLength"),
                     targetLength = iCrypto.pRequired("encodeBlobLength"),
                     paddingChar = iCrypto.pRequired("encodeBlobLength"),
                     nameToSave = iCrypto.pRequired("encodeBlobLength")){
        if(!typeof (paddingChar) === "string"){
            throw "encodeBlobLength: Invalid padding char";
        }
        let l = String(this.get(target).length);
        let paddingLength = targetLength - l.length;
        if (paddingLength<0){
            throw "encodeBlobLength: String length exceedes target length";
        }
        let padding = paddingChar[0].repeat(paddingLength);
        this.set(nameToSave, (padding + l));
        return this;
    }

    /************SERVICE FUNCTIONS**************/

    static arrayBufferToString(buf) {
        return String.fromCharCode.apply(null, new Uint16Array(buf));
    }


    static stringToArrayBuffer(str) {
        var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
        var bufView = new Uint16Array(buf);
        for (var i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    }

    /**
     * TODO make it universal and for arbitrary number of arrays     *
     * @param arr1
     * @param arr2
     * @returns {Uint8Array}
     */
    static concatUint8Arrays(arr1, arr2){
        let res = new Uint8Array(arr1.byteLength + arr2.byteLength);
        res.set(arr1, 0);
        res.set(arr2, arr1.byteLength);
        return res;
    }

    /**
     * Concatinates 2 array buffers in order buffer1 + buffer2
     * @param {ArrayBuffer} buffer1
     * @param {ArrayBuffer} buffer2
     * @returns {ArrayBufferLike}
     */
    static concatArrayBuffers (buffer1, buffer2) {
        let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
        return tmp.buffer;
    };


    static getBytes(length){
        return forge.random.getBytesSync(length);
    }

    static hexEncode(blob){
        return forge.util.bytesToHex(blob);
    }

    static hexDecode(blob){
        return forge.util.hexToBytes(blob);
    }

    static base64Encode(blob){
        return forge.util.encode64(blob);
    }

    static base64Decode(blob){
        return forge.util.decode64(blob);
    }

    /**
     * Returns random integer
     * @param a
     * @param b
     */
    static randInt(min, max) {
        if (max === undefined) {
            max = min;
            min = 0;
        }

        if (typeof min !== 'number' || typeof max !== 'number') {
            throw new TypeError('Expected all arguments to be numbers');
        }

        return Math.floor(Math.random() * (max - min + 1) + min);
    };

    static createRandomHexString(length){
        let bytes = iCrypto.getBytes(length);
        let hex = iCrypto.hexEncode(bytes);
        let offset = iCrypto.randInt(0, hex.length - length);
        return hex.substring(offset, offset+length);
    }

    get  (name){
        if (this.keysExist(name))
            return this.store[name];
        throw "Property " + name + " not found"
    };

    set (name, value){
        if (this.locked)
            throw "Cannot add property: object locked";
        this.assertKeysAvailable(name);
        this.store[name] = value;
    };

    lock(){
        this.locked = true;
    };

    unlock(){
        this.locked = false;
    };

    assertKeysAvailable(keys){
        if (this.keysExist(keys))
            throw "Cannot add property: " + keys.toString() + " property with such name already exists";
    }

    keysExist(keys){
        if (!keys)
            throw "keysExist: Missing required arguments";
        if(typeof (keys) === "string" || typeof(keys) === "number")
            return this._keyExists(keys);
        if(typeof (keys) !== "object")
            throw ("keysExist: unsupported type");
        if(keys.length<1)
            throw "array must have at least one key";

        let currentKeys = Object.keys(this.store);

        for (let i=0; i< keys.length; ++i){
            if (!currentKeys.includes(keys[i].toString()))
                return false;
        }
        return true;
    }

    _keyExists(key){
        if (!key)
            throw "keyExists: Missing required arguments";
        return Object.keys(this.store).includes(key.toString());
    }

    static pRequired(functionName = "iCrypto function"){
        throw functionName + ": missing required parameter!"
    }

    throwError(message = "Unknown error"){
        throw message;
    }
}


class Base32{
    constructor(){

        this.RFC4648 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
        this.RFC4648_HEX = '0123456789ABCDEFGHIJKLMNOPQRSTUV'
        this.CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    }

    encode (buffer, variant) {
        var alphabet, padding;

        switch (variant) {
            case 'RFC3548':
            case 'RFC4648':
                alphabet = this.RFC4648;
                padding = true;
                break;
            case 'RFC4648-HEX':
                alphabet =  this.RFC4648_HEX;
                padding = true;
                break;
            case 'CROCKFORD':
                alphabet =  this.CROCKFORD;
                padding = false;
                break;
            default:
                throw new Error('Unknown base32 variant: ' + variant)
        }

        var length = buffer.byteLength;
        var view = new Uint8Array(buffer);

        var bits = 0;
        var value = 0;
        var output = '';

        for (var i = 0; i < length; i++) {
            value = (value << 8) | view[i];
            bits += 8;

            while (bits >= 5) {
                output += alphabet[(value >>> (bits - 5)) & 31]
                bits -= 5
            }
        }

        if (bits > 0) {
            output += alphabet[(value << (5 - bits)) & 31]
        }

        if (padding) {
            while ((output.length % 8) !== 0) {
                output += '='
            }
        }

        return output
    }

}


