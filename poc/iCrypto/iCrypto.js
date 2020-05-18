'use strict';
const lzma = require('lzma');
const forge = require('node-forge');
const base32 = require('base32');
const crypto = require('crypto');


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
        this.settings = {};
        this.locked = false;

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
    createNonce(nameToSave = this.pRequired("createNonce"), length=32){
        let nonce = forge.random.getBytesSync(length);
        this.set(nameToSave, nonce);
        return this;
    }

    asyncAddPlainText(nameToSave, plainText){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.addPlainText(nameToSave, plainText));
            } catch (err){
                reject(err);
            }
        })
    }

    addPlainText(nameToSave = this.pRequired("addPlainText"), plainText = this.pRequired("addPlainText")){
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

    createSYMKey(nameToSave = this.pRequired("createSYMKey"), ivLength=16, keyLength=32){
        const key = forge.random.getBytesSync(32);
        const iv = forge.random.getBytesSync(32);
        this.set(nameToSave, {iv:iv, key:key, ivLength: ivLength, keyLength:keyLength});
        return this;
    }

    asyncAESEncrypt(target, key, nameToSave ){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.AESEncrypt(target, key, nameToSave));
            } catch (err){
                reject(err);
            }
        })
    }

    /**
     *
     * @param {string} name
     * @param {string} key
     * @param {string} nameToSave
     *  name: key to text to encrypt
     *  key: key to previously generated AES key stored inside the object
     *  nameToSave: new key to save resulting cipher
     */
    AESEncrypt(target = this.pRequired("AESEncrypt"),
               key = this.pRequired("AESEncrypt"),
               nameToSave = this.pRequired("AESEncrypt")){

        const iv = this.get(key).iv;
        const AESkey = this.get(key).key;
        const cipher = forge.cipher.createCipher('AES-CBC', AESkey);
        cipher.start({iv:iv});
        cipher.update(forge.util.createBuffer(this.get(target)));
        cipher.finish();
        this.set(nameToSave, cipher.output);
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
     *
     * @param {string} target
     * @param {string} key
     * @param {string} nameToSave
     *  name: key to cipher to decrypt
     *  key: key to previously generated AES key stored inside the object
     *  nameToSave: new key to save result of decryption
     */
    AESDecrypt(target = this.pRequired("AESDecrypt"),
               key = this.pRequired("AESDecrypt"),
               nameToSave = this.pRequired("AESDecrypt")){

        let iv = this.get(key).iv;
        let AESkey = this.get(key).key;
        let decipher = forge.cipher.createDecipher('AES-CBC', AESkey);
        decipher.start({iv:iv});
        decipher.update(this.get(target));
        decipher.finish();
        this.set(nameToSave, decipher.output.toString());
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
     *
     * @param target
     * @param nameToSave
     * @param algorithm
     * @param {number} targetType
     *  ENUM: 0 - string, 1 - public key, 2 - private key
     */
    hash(target = this.pRequired("hash"),
         nameToSave  = this.pRequired("hash"),
         algorithm = "sha256",
         targetType = 0){
        algorithm = algorithm.toLowerCase();
        let hash = forge.md.hasOwnProperty(algorithm) ? forge.md[algorithm].create(): iCrypto.throwError("Wrong hash algorithm");
        hash.update(this.get(target));
        this.set(nameToSave, hash.digest().toHex());
        return this
    }

    getPublicKeyFingerprint(target = this.pRequired("hash"),
                            nameToSave  = this.pRequired("hash"),
                            hexify = false){


        let pubKey = forge.pki.publicKeyFromPem(this.get(target).publicKey);
        let result = hexify ? forge.pki.getPublicKeyFingerprint(pubKey).toHex() : forge.pki.getPublicKeyFingerprint(pubKey);
        console.log(this.get(target).publicKey);
        console.log(result);

        let der = forge.asn1.toDer(pubKey);
        let derEncoded = base32.encode(der);
        console.log(derEncoded);
        this.set(nameToSave, result);
        return this;
    }
    //TEMP
    deriveOnionHash(){
        let pubKey = "-----BEGIN PUBLIC KEY-----\n" +
            "MIGgMA0GCSqGSIb3DQEBAQUAA4GOADCBigKBgQDDIs04wcnxNhI/00HmePx1zH89\n" +
            "FeMP8C8PwUz9qi5KhBlh3EWad7MIC5AU+sBsw2Fhz2U8fFjaZj3JTWzUMX3qRR+2\n" +
            "u7DVbBlQ9c4aZIJRe8cbllKIpVSnbyKSs7/s/D/V66v4onYvGHfqdkVyxOxVGbki\n" +
            "YzXbx/522h+rmQBu5wIEXwD+PQ==\n" +
            "-----END PUBLIC KEY-----";





        console.log(forgeDerBuffer);

        let manDER = forge.util.decode64(pubKey);
        console.log( manDER);


        let hsh = forge.pki.getPublicKeyFingerprint(forgepk, {type: 'SubjectPublicKeyInfo'});

        let hash32 = base32.encode(hsh.data);
        console.log(hsh);
        console.log(hash32);
        return hash32;

    }




    //END TEMP




    asyncCreateKeyPair(nameToSave = this.pRequired("createKeyPair"), length = 2048){
        return new Promise((resolve, reject)=>{
            forge.rsa.generateKeyPair({bits: length, workers: 2}, (err, pair)=> {
                if (err)
                    reject(err);
                else{
                    try{

                        let pubKey =  forge.pki.publicKeyToPem(pair.publicKey);
                        let privKey = forge.pki.privateKeyToPem(pair.privateKey);
                        this.set(nameToSave, {publicKey: pubKey,
                            privateKey: privKey,
                            keyType: "RSA",
                            length: length});
                        resolve(this);

                    } catch(err){

                        reject(err);

                    }
                }
            });
        })
    }

    /**
     * Creates RSA key pair.
     * Key saved in PEM format
     * resulting object has publicKey, privateKey, keyType, length
     * @param nameToSave
     * @param length
     * @returns {iCrypto}
     */
    createKeyPair(nameToSave = this.pRequired("createKeyPair"), length = 2048){
        let pair = forge.pki.rsa.generateKeyPair({bits: length, e: 0x10001});
        let pubKey =  forge.pki.publicKeyToPem(pair.publicKey);
        let privKey = forge.pki.privateKeyToPem(pair.privateKey);

        this.set(nameToSave, {publicKey: pubKey,
                        privateKey: privKey,
                        keyType: "RSA",
                        length: length});
        return this;
    }

    asyncPublicKeyEncrypt(target, keyPair, nameToSave){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.publicKeyEncrypt(target, keyPair, nameToSave))
            } catch (err){
                reject(err);
            }

        })
    }

    publicKeyEncrypt(target = this.pRequired("publicKeyEncrypt"),
                     keyPair = this.pRequired("publicKeyEncrypt"),
                     nameToSave = this.pRequired("publicKeyEncrypt")){
        let publicKey = forge.pki.publicKeyFromPem(this.get(keyPair).publicKey);
        this.set(nameToSave, publicKey.encrypt(this.get(target)));

        return this;
    }

    /* Do we need priv key encryption and pub key decryption just for signatures?
     publicKeyDecrypt(name = this.pRequired("publicKeyDecrypt"),
                      keyPair = this.pRequired("publicKeyDecrypt"),
                      nameToSave = this.pRequired("publicKeyDecrypt")){
         let publicKey = forge.pki.publicKeyFromPem(this.get(keyPair).publicKey);
         this.set(nameToSave, publicKey.decrypt(this.get(name)));

         return this;
     }


     privateKeyEncrypt(name = this.pRequired("privateKeyEncrypt"),
                      keyPair = this.pRequired("privateKeyEncrypt"),
                      nameToSave = this.pRequired("privateKeyEncrypt")){
         let privateKey = forge.pki.privateKeyFromPem(this.get(keyPair).privateKey);
         this.set(nameToSave, privateKey.sign(this.get(name)));

         return this;
     }
     */

    asyncPrivateKeyDecrypt(target, keyPair, nameToSave){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.privateKeyDecrypt(target, keyPair, nameToSave))
            }catch(err){
                reject(err);
            }
        })
    }

    privateKeyDecrypt(target = this.pRequired("privateKeyDecrypt"),
                      keyPair = this.pRequired("privateKeyDecrypt"),
                      nameToSave = this.pRequired("privateKeyDecrypt")){
        let privateKey = forge.pki.privateKeyFromPem(this.get(keyPair).privateKey);
        this.set(nameToSave, privateKey.decrypt(this.get(target)));

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

    privateKeySign(target = this.pRequired("privateKeyEncrypt"),
                      keyPair = this.pRequired("privateKeyEncrypt"),
                      nameToSave = this.pRequired("privateKeyEncrypt")){
        const privateKey = forge.pki.privateKeyFromPem(this.get(keyPair).privateKey);
        const md = forge.md.sha256.create();
        md.update(this.get(target));
        const signature = privateKey.sign(md);
        this.set(nameToSave, signature);
        return this;
    }


    asyncPublicKeyVerify(target, signature, keyPair, nameToSave){
        return new Promise((resolve, reject)=>{
            try{
                resolve(this.publicKeyVerify(target, signature, keyPair, nameToSave));
            } catch(err){
                reject(err);
            }
        })
    }

    publicKeyVerify(target = this.pRequired("publicKeyVerify"),
                    signature = this.pRequired("publicKeyVerify"),
                    keyPair = this.pRequired("publicKeyVerify"),
                    nameToSave = this.pRequired("publicKeyVerify")){

        let publicKey = forge.pki.publicKeyFromPem(this.get(keyPair).publicKey);
        const md = forge.md.sha256.create();
        md.update(this.get(target));
        const verified = publicKey.verify(md.digest().bytes(), this.get(signature));
        this.set(nameToSave, verified);

        return this;
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
    compress(target = this.pRequired("compress"), nameToSave = this.pRequired("compress")){
        let compressed = LZMA.compress(this.get(target));
        this.set(nameToSave, compressed);
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
    decompress(target = this.pRequired("decompress"),
               nameToSave = this.pRequired("decompress")){
        let decompressed = LZMA.decompress(this.get(target));
        this.set(nameToSave, decompressed);
    }


    /***#### UTILS ####***/

    base64Encode(name = this.pRequired("base64Encode"), nameToSave = this.pRequired("base64Encode")){
        this.set(nameToSave, forge.util.encode64(this.get(name)));
    }

    base64Decode(name = this.pRequired("base64decode"), nameToSave = this.pRequired("base64decode")){
        this.set(nameToSave, forge.util.decode64(this.get(name)));
    }

    bytesToHex(name = this.pRequired("bytesToHex"), nameToSave = this.pRequired("bytesToHex")){
        this.set(nameToSave, forge.util.bytesToHex(this.get(name)));
    }

    hexToBytes(name = this.pRequired("hexToBytes"), nameToSave = this.pRequired("hexToBytes")){
        this.set(nameToSave, forge.util.hexToBytes(this.get(name)));
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
    merge(things = this.pRequired("merge"), nameToSave  = this.pRequired("merge")){

        if (!this.keysExist(things))
            throw "merge: some or all objects with such keys not found ";

        console.log("Mergin' things");
        let result = "";
        for (let i= 0; i< things.length; ++i){
            let candidate = this.get(things[i]);
            if (typeof (candidate) === "string" || typeof(candidate) ==="number" )
                result += candidate;
            else
                throw "Object is not mergeable";
        }
        this.set(nameToSave, result);
        return this;
    }


    /************SERVICE FUNCTIONS**************/
    get  (name){
        if (this.keysExist(name))
            return this[name];
        throw "Property not found"
    };

    set (name, value){
        if (this.locked)
            throw "Cannot add property: object locked";
        this.assertKeysAvailable(name);
        this[name] = value;
    };

    lock(){
        this.locked = true;
    };

    unlock(){
        this.locked = false;
    };

    assertKeysAvailable(keys){
        if (this.keysExist(keys))
            throw "Cannot add property: property with such name already exists";
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

        let currentKeys = Object.keys(this);

        for (let i=0; i< keys.length; ++i){
            if (!currentKeys.includes(keys[i].toString()))
                return false;
        }
        return true;
    }

    _keyExists(key){
        if (!key)
            throw "keyExists: Missing required arguments";
        return Object.keys(this).includes(key.toString());
    }

    static pRequired(functionName = "iCrypto function"){
        throw functionName + ": missing required parameter!"
    }

    static throwError(message = "Unknown error"){
        throw message;
    }
}

module.exports = iCrypto;