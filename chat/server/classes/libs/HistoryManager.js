const fs = require('fs-extra');
const path = require("path");
const TaskQueue = require("./TaskQueue.js");
const Err = require('./IError.js');
const CuteSet = require("cute-set");
const WrapupRecord = require("../objects/WrapupRecord.js");
const HistoryFixer = require("../libs/HistoryIndexFixer.js");
const Logger = require("../libs/Logger.js");



class HistoryManager{

    constructor(pathToHistoryDirectory){
        this.setHistoryDirectroryPath(pathToHistoryDirectory);
        this.setCommonPaths();
        this.setTopicKeyPaths();
        this.appendQueues = {};
        this.numberOfQueues = 4;
        this._pkfpQueueMapping = {};
        this.initQueues();
    }

    initQueues(){
        let ids = this.getAllhistoryIDs(true);
        for (let i=0; i<this.numberOfQueues; ++i){
            this.appendQueues[i] = {
                queue: new TaskQueue(),
                clients: 0
            };
        }
        for (let i=0; i<ids.length; ++i){
            this._pkfpQueueMapping[ids[i]] = i%this.numberOfQueues;
            this.appendQueues[i%this.numberOfQueues].clients +=1;
        }
    }

    setHistoryDirectroryPath(hPath){
        hPath = hPath ? hPath: "../history/";
        if (!fs.existsSync(hPath)){
            console.log("Path does not exist. Creating...");
            fs.mkdirSync(hPath);
        }
        this.historyDirectory = hPath;
    }

    getHistoryDirectory(){
        return this.historyDirectory;
    }

    setCommonPaths(){
        this.commonPaths = {
            topicRoot: "",
            topicAuthority: "",
            invites: "/invites/",
            inviteIndex: "/invites/invite_index",
            files: "/files/",
            history: "/history_store",
            taMetadata: "/metadata",
            settings: "/settings"
        };
    }


    /**
     * Set path to key files for particular topic key types
     */
    setTopicKeyPaths(){
        this.topicKeyPaths = {
            ownerHSPrivateKey: "/client_hs_key", //Encrypted private key for Owner (client) hidden service
            ownerPublicKey: "/client_public_key", //Raw owner's (client) public key
            taHSPrivateKey: "/topic_hs_private_key", //Encrypted private key for topic hidden service
            taPrivateKey: "/topic_private_key", //Encrypted topic authority private key () required to sign metadata and invites)
        }
    }


    /**
     * initializes new topic and history file. After completion history will be found in
     * historyDirectory/topicID/history
     * @param pkfp - going to be a directory name in the history directory
     * @param ownerPublicKey
     * @param ownerHSKey - encrypted private key for user's hidden service.
     *          Will be appended as is to private key file.
     */
    initTopic(pkfp = Err.required("HistoryManager initTopic error: missing required parameter 'pkfp'"),
              ownerPublicKey = Err.required("HistoryManager initTopic error: missing required parameter 'ownerPublicKey'"),
              ownerHSKey = Err.required("HistoryManager initTopic error: missing required parameter 'ownerHSKey'")){
        return new Promise((resolve, reject)=>{
	    Logger.debug("Initializing topic for pkfp: " + pkfp);
			 
            let self = this;
            try{
                let topicPath = path.join(self.historyDirectory , pkfp);
                if (fs.existsSync(topicPath)) {
                    reject("Topic with such id already exists!");
                    return;
                }

                //Creating topic directory
                fs.mkdirSync(topicPath);

                //Creating files directory
                fs.mkdirSync(this.getPath(pkfp, "files"));

                //Writing topic keys
                this.setTopicKey(pkfp, "ownerPublicKey",  ownerPublicKey);
                this.setTopicKey(pkfp, "ownerHSPrivateKey",  ownerHSKey);
                resolve();
            } catch(err){
                console.log(err);
                reject(err)
            }
        })
    }




    /**
     * Saves passed settingsBlob
     * Assumes that settings blob is already encrypted
     * @param pkfp
     * @param settingsBlob
     */
    async saveClientSettings(pkfp = Err.required("HistoryManager saveClientSettings error: missing required parameter 'pkfp'"),
                       settingsBlob =  Err.required("HistoryManager saveClientSettings error: missing required parameter 'settingsBlob'")) {
        let path = this.getPath(pkfp, "settings");
        fs.writeFile(path, settingsBlob, (err) => {
            if (err) {
                throw err;
            }
        });
    }


    getClientSettings(pkfp = Err.required("HistoryManager getClientSettings error: missing required parameter 'pkfp'")){
        let path = this.getPath(pkfp, "settings");
        if(!fs.existsSync(path)){
            return "";
        }
        let data = fs.readFileSync(path);
        return data.toString();
    }

    initHistory(pkfp, metadataBlob){
        return new Promise(async (resolve, reject)=>{
            try{
                if (typeof(metadataBlob) !== "string"){
                    reject(new Error("metadataBlob must be type of string. Received type of: ") + typeof (metadataBlob));
                    return;
                }
                let pathToHistory = this.pathToHistory(pkfp);
                if(fs.existsSync(pathToHistory)){
                    reject(new Error("History file already exists"));
                    return;
                }

                let wru = new WrapupRecord();
                wru.setLastMetadata(0, metadataBlob.length);
                let content = metadataBlob + wru.toBlob();
                await this._appendHistory(pkfp, content);
                let ownerPublicKey = JSON.parse(metadataBlob).body.participants[pkfp].publicKey;
                await this.writeOwnersPublicKey(pkfp, ownerPublicKey);
                resolve();
            } catch(err){
                reject(err);
            }
        })
    }

    async burnHistory(pkfp =Err.required("HistoryManager burnHistory error: missing required parameter 'pkfp'")){
        let path = this.pathToHistory(pkfp);
        fs.remove(path)
    }

    /**
     * Writes public key of the history's owner to the topic folder
     * @param pkfp
     * @param publicKey
     */
    writeOwnersPublicKey(pkfp, publicKey){
        return new Promise((resolve, reject)=>{
            let opkPath = this.getKeyPath(pkfp, "ownerPublicKey");
            fs.writeFile(opkPath, publicKey, (err)=>{
                if (err){reject(err); return;}
                resolve();
            })
        })
    }

    /**
     * Given pkfp of a history owner - returns public key
     * of the owner
     * @param pkfp
     * @returns {Promise}
     */
    getOwnerPublicKey(pkfp){
        return new Promise(async (resolve, reject)=>{
            try{
                let metadata = JSON.parse(await this.getLastMetadata(pkfp));
                resolve(metadata.body.participants[pkfp].publicKey);
            }catch(err){
                reject(err);
            }
        })
    }

    /**
     * Given history owner's pkfp and
     * some participant pkfp returns public key of given participant
     * @param ownerPkfp
     * @param participantPkfp
     * @param metaID
     * @returns {Promise<any>}
     */
    getParticipantPublicKey(ownerPkfp, participantPkfp, metaID){
        return new Promise(async(resolve, reject)=>{
            try{
                Logger.debug("Get participant public key request...")
                let self = this;
                let lastMeta = JSON.parse(await self.getMetadata(ownerPkfp, metaID))
                let publicKey = lastMeta.body.participants[participantPkfp].publicKey;
                resolve(publicKey)
            }catch(err){
                Logger.error("Error getting participant public key: " + err)
                reject(err)
            }
        })
    }

    async getClientHSPrivateKey(pkfp){
        return await this.getTopicKey(pkfp, "ownerHSPrivateKey");

    }

    writeClientHSPrivateKey(pkfp, keyData){
        this.setTopicKey(pkfp, "ownerHSPrivateKey", keyData)
    }


    /*****************************************************
     * Topic authority persistence
     ****************************************************/

    initTopicAuthority(taPkfp = Err.required()){
        let path = this.getPath(taPkfp, "topicAuthority");
        let pathInvites = this.getPath(taPkfp, "invites");
        if(fs.existsSync(path)){
            throw new Error("Cannot initialize topic authority directory - it is already exists");
        }

        fs.mkdirSync(path);
        fs.mkdirSync(pathInvites);
    }


    taAppendMetadata(taPkfp, metadata){
        let appendQueue = this.getAppendQueue(taPkfp);
        appendQueue.enqueue(this._preapreTaAppendMetadataJob(taPkfp, metadata));
        return appendQueue.run();
    }

    /**
     * Appends metadata to TopicAuthority metadata file
     * @param taPkfp
     * @param metadata
     */
    _preapreTaAppendMetadataJob(taPkfp, metadata){
        if (typeof(metadata) !== "string"){
            throw new Error("taAppendMetadata error - metadata must be type of string");
        }
        return async function(){
            let hm = this.hm;
            let path = hm.getPath(this.taPkfp, "taMetadata");
            let start, wrup;

            if(fs.existsSync(path) && fs.statSync(path).size > 64){
                wrup =  await hm.getWrapupBlob(this.taPkfp, undefined, "ta-metadata");
                wrup = new WrapupRecord(wrup);
                start = hm.taGetMetadataSize(this.taPkfp);
            } else {
                wrup = new WrapupRecord();
                start = 0;
            }

            let end = start + this.metadata.length;
            wrup.setLastMetadata(start, end);

            const res = this.metadata + wrup.toBlob();

            await hm._appendTAMetadata(this.taPkfp, res);
        }.bind({taPkfp: taPkfp, metadata: metadata, hm: this})
    }


    getAppendQueue(pkfp){
        if(!this._pkfpQueueMapping.hasOwnProperty(pkfp)){
            this.addAppendQueueClient(pkfp);
        }
        return this.appendQueues[this._pkfpQueueMapping[pkfp]].queue;
    }

    addAppendQueueClient(pkfp){
        let minimal = {min: Infinity, id: null};
        for(let id of Object.keys(this.appendQueues)){
            if (this.appendQueues[id].clients < minimal.min){
                minimal.min = this.appendQueues[id].clients;
                minimal.id = id;
            }
        }
        this._pkfpQueueMapping[pkfp] = minimal.id;
        this.appendQueues[minimal.id].clients += 1;
    }


    async taGetLastMetadata(pkfp){
        return await this.taGetMetadata(pkfp);
    }

    async taGetMetadata(pkfp, start, length){
        let endPos;
        if (start && length){
            endPos = parseInt(start) + parseInt(length);
        }
        let wrapupBlob = await this.getWrapupBlob(pkfp, endPos, "ta-metadata");
        let wrup = new WrapupRecord(wrapupBlob);
        let mStart = wrup.lastMetadataStart;
        let mLength = wrup.lastMetadataEnd - wrup.lastMetadataStart;
        let buffer = await this.getHistoryElement(mLength, mStart, pkfp, "ta-metadata");
        let blob = buffer.toString();

        return buffer.toString();
    }

    taSavePrivateKey(taPkfp, keyData){
        this.setTopicKey(taPkfp, "taPrivateKey",  keyData);
    }

    taGetPrivateKey(){
        this.getTopicKey(taPkfp, "taPrivateKey");
    }

    taSaveHsPrivateKey(taPkfp, keyData){
        this.setTopicKey(taPkfp, "taHSPrivateKey", keyData);
    }

    taGetHsPrivateKey(){
        this.getTopicKey(taPkfp, "taHSPrivateKey");
    }


    async taGetInvite(inviteId = Err.required(), pkfp = Err.required()){
        let invitePath = path.join(this.pathToInvites(pkfp) , inviteId);
        if (! await fs.exists(invitePath)  ){
            Logger.warn("INVITE COULD NOT BE FOUND: " + invitePath, {
                cat: "topic_join"
            });
            throw new Error("Invite does not exist");
        }
        let data = await fs.readFile(invitePath);
        return data.toString();
    }

    async taDelInvite(inviteId = Err.required(), pkfp = Err.required()){
        let invitePath = path.join(this.pathToInvites(pkfp) , inviteId);
        if (! await fs.exists(invitePath)  ){
            return
        }
        await fs.unlink(invitePath)
        return;
    }

    saveNewInvite(blob, inviteID, pkfp ){
        return new Promise((resolve, reject)=>{
            let invitePath = this.pathToInvites(pkfp);
            if (!fs.existsSync(invitePath)){
                fs.mkdirSync(invitePath);
            }
            fs.writeFile(path.join(invitePath , inviteID), blob, (err)=>{
                if (err) {
                    console.log("Error saving the invite: " + err);
                    reject(err);
                }else{
                    resolve();
                }
            })
        })
    }





    /**
     * Removes invite file
     * @param pkfp
     * @param inviteCode
     */
    consumeInvite(pkfp = Err.required("consumeInvite"),
                  inviteCode = Err.required("consumeInvite")){
        return new Promise((resolve, reject)=>{
            try{
                let invitePath = path.join(this.pathToInvites(pkfp), inviteCode);
                fs.unlink(invitePath, (err)=>{
                    if (err) reject(err);
                    resolve();
                })
            } catch(err){
                console.log("Error deleting invite file: " + err);
                reject(err)
            }
        })
    }


    /*****************************************************
     * ~ END Topic authority persistence ~
     ****************************************************/


    /**
     * Returns last metadata record from history file
     * given history owner's pkfp
     * @param {String} pkfp
     */
    async getLastMetadata(pkfp){
        console.log("getLastMetadata pkfp: " + pkfp);
        //get last wrapup record - last 64 bytes of a file
        let wrapupBlob = await this.getWrapupBlob(pkfp)
        let wrup = new WrapupRecord(wrapupBlob);
        let mStart = wrup.lastMetadataStart;
        let mLength = wrup.lastMetadataEnd - wrup.lastMetadataStart;
        let buffer = await this.getHistoryElement(mLength, mStart, pkfp)
        let metadata = buffer.toString();
        return metadata;
    }

    /**
     * Given topic owner's pkfp and metadata ID - return that metadata
     * @param pkfp
     * @param id
     */
    async getMetadata(pkfp, id){
        Logger.debug("Get metadata called. Pkfp: " + pkfp + " id: " + id );
        let self = this;
        if (id === undefined){
            //if id not defined - just returning last metadata
            return self.getLastMetadata(pkfp);
        }

        let endPos;
        while(1) {
            let wrapupBlob = await this.getWrapupBlob(pkfp, endPos);
            let wrup = new WrapupRecord(wrapupBlob);
            let mStart = wrup.lastMetadataStart;
            let mLength = wrup.lastMetadataEnd - wrup.lastMetadataStart;
            let buffer = await this.getHistoryElement(mLength, mStart, pkfp);
            let metadata = buffer.toString();
            if (metadata.indexOf(id) !== -1) {
                return metadata;
            } else if (mStart === 0) {
                return
            }
            endPos = mStart
        }
    }


    /**
     * Creates and returns attachment file stream
     * @param pkfp
     * @param fileName
     * @param mode r - read stream; w - write stream
     * @returns {*}
     */
    createAttachmentFileStream(pkfp, fileName, mode = "w"){
        let filesPath = this.getPath(pkfp, "files");
        if (!fs.existsSync(filesPath)){
            fs.mkdirSync(filesPath);
        }

        if (mode==="w") {
            return fs.createWriteStream(path.join(filesPath, fileName));
        } else if (mode === "r"){
            return fs.createReadStream(path.join(filesPath, fileName));
        } else {
            throw new Error("createAttachmentFileStream: invalid mode " + mode);
        }
    }




    /**
     * Checks whether file with name exists in files folder in the given topic
     * @param pkfp
     * @param name
     * @returns {*}
     */
    fileExists(pkfp, name){
        let filesPath = this.getPath(pkfp, "files")
        console.log("files path: " + filesPath);
        console.log("file name: " + name)
        let _path = path.join(filesPath, name);
        console.log("Checking if exists: " + _path);
        return fs.existsSync(_path)
    }

    getFileStat(pkfp, name){
        let self = this;
        if(!self.fileExists(pkfp, name)){
            throw new Error("history manager getFileStat: file does not exist");
        }
        let fPath = this.getPath(pkfp, "files");
        let stat = fs.fstatSync(path.join(fPath , name));
        return stat
    }

    deleteFileOnTransferFail(pkfp, name){
        let fPath = path.join(this.getPath(pkfp, "files"), name);
        if(fs.existsSync(fPath)){
            fs.unlinkSync(fPath  + name)
        }
    }

    /**
     * Renames temporary file after upload is complete
     * throws error if file is not found
     * @param pkfp
     * @param tempName
     * @param name
     */
    renameTempUpload(pkfp, tempName, name){
        return new Promise((resolve, reject)=>{
            let self = this;
            let fPath  = this.getPath(pkfp, "files");
            let oldName = path.join(fPath  , tempName);
            let newName = path.join(fPath , name);
            let maxAttempts = 4;
            let timeout = 1000;
            let attempted = 0;

            function renameAttempt(){
                Logger.debug(`File exists. Renaming. Attempt: ${attempted}`, {cat: "files"});
                fs.rename(oldName, newName, (err)=>{
                    if (err){
                        if ((/BSY/i.test(err.code) || /BUSY/i.test(err.code)) && attempted < maxAttempts){
                            Logger.warn(`Error renameing file: file is busy. Attempt: ${attempted}`, {cat: "files"})
                            attempted++;
                            setTimeout(renameAttempt, timeout);
                        }else {
                            Logger.error("Error renaming file: " + err, {cat: "files"})
                            console.log("ERROR renaming file: " + err);
                            reject(new Error("renameTempUpload error: " + err));
                        }
                    } else {
                        //success
                        console.log("Renamed. Resolving...")
                        resolve();
                    }

                });
            }
            renameAttempt();
        })
    }

    /**
     * Returns wrapup record as utf8 String.
     * if endPos is not specified - it gets last record in the history file
     * which is last 64 bytes.
     * @param pkfp
     * @param endPos
     */
    getWrapupBlob(pkfp, endPos, type = "history"){
        return new Promise((resolve, reject)=>{
            endPos = endPos ? endPos - 64 : undefined;
            if (endPos < 0) {
                reject(new Error("Invalid start position for the history element"));
                return;
            }
            this.getHistoryElement(64, endPos, pkfp, type)
                .then((buffer)=>{
                    resolve(buffer.toString('utf8'));
                })
                .catch((err) =>{
                    reject(err);
                })
        })
    }

    getWrapupBlobSync(pkfp, endPos){
        endPos = endPos ? endPos - 64 : undefined;
        if (endPos < 0) {
            console.log("invalid end position for wrapup record.");
            return;
        }
        return this.getHistoryElementSync(64, endPos, pkfp).toString()
    }

    /**
     * Returns a promise of history element as uint8 buffer, no encoding
     * @param {number}length - length of the history element
     * @param {number}start - start position in the history file
     * @param pkfp
     */
    getHistoryElement(length, start, pkfp, type = "history"){
        //console.log("getHistoryElement pkfp: " + pkfp);
        return new Promise((resolve, reject)=>{
            length = parseInt(length);

            let path;
            if (type === "history"){
                path = this.pathToHistory(pkfp);
            }else if (type === "ta-metadata"){
                path = this.getPath(pkfp, "taMetadata")
            }

            fs.stat(path, (errStat, stats)=>{
                if (errStat) {
                    reject(errStat);
                    return;
                }
                else if(!stats) {
                    reject( new Error("History file does not exist"));
                    return;
                }

                fs.open(path, 'r', (errOpen, fd)=>{
                    if (errOpen) reject(errOpen);
                    start = typeof(start) !== "undefined" ? parseInt(start) : stats.size - length;
                    fs.read(fd, Buffer.alloc(length), 0, length, start, (errRead, bytes, buffer )=>{
                        if (errRead) reject(errRead);
                        fs.close(fd, ()=>{
                            resolve(buffer);
                        });

                    })
                })
            })
        });
    }


    getHistoryElementSync(length, start, pkfp){
        let stats = fs.statSync(this.pathToHistory(pkfp));
        if (!stats) throw ("History file does not exist");
        start = typeof(start) !== "undefined" ? parseInt(start) : stats.size - length;
        let buffer = Buffer.alloc(length);
        let fd = fs.openSync(this.pathToHistory(pkfp), 'r');
        let bytesRead = fs.readSync(fd, buffer, 0, length, start);
        fs.closeSync(fd);
        return buffer;
    }

    async getLastMetadataRecords(lastMetaId = Err.required(),
                                 pkfp = Err.required()){
        const path  = this.getPath(pkfp, "taMetadata");
        const res = [];
        let endPos = undefined;
        while(1){
            let wrapupBlob = await this.getWrapupBlob(pkfp, endPos, "ta-metadata");
            let wrup = new WrapupRecord(wrapupBlob);
            let mStart = wrup.lastMetadataStart;
            let mLength = wrup.lastMetadataEnd - wrup.lastMetadataStart;
            let buffer = await this.getHistoryElement(mLength, mStart, pkfp, "ta-metadata");
            let metadata =  buffer.toString();
            if(metadata.indexOf(lastMetaId) !== -1 || mStart === 0) break;
            res.push(metadata);
            endPos = mStart
        }
        return res;
    }

    getLastMessagesAndKeys(numberOfLastMessages, pkfp) {
        return new Promise((resolve, reject)=>{
            try{

                let messages, keys;
                let allLoaded = false;

                this.loadMoreMessages(pkfp, undefined, numberOfLastMessages)
                    .then((data)=>{
                        messages = data[0];
                        keys = data[1];
                        allLoaded = data[2];
                        if(messages.length === 0){
                            resolve({messages: [], keys: {}, allLoaded: allLoaded});
                            return;
                        }

                        //Get all shared keys from previous tas
                        return this.getSharedKeysSet(keys, pkfp)
                    })
                    .then(gatheredKeys =>{
                        resolve({messages: messages, keys: gatheredKeys, allLoaded: allLoaded})
                    })
            }catch(err){
                reject(err)
            }

        })
    }

    getAllhistoryIDs(includingTAMetadata = false){
        return fs.readdirSync(this.historyDirectory).filter(name =>{
            let hPath = this.getPath(name, "history");
            let rPath = this.getPath(name, "topicRoot");
            return includingTAMetadata ?  (fs.statSync(rPath).isDirectory()) :
                     (fs.statSync(rPath).isDirectory() && fs.existsSync(hPath));
        })
    }

    /**
     * Given set of metadata IDs and
     * pkfp of a user gather encrypted shared keys for given meta IDS
     *
     * Resolves with dictionary of metaID -> shared key mapping
     *
     * @param {Object} keys - set of metadata IDs
     * @param pkfp - public key fingerprint of a user
     * @returns {Promise<any>}
     */
    getSharedKeysSet(keys, pkfp){
        return new Promise((resolve, reject)=>{
            try{
                let res = {};
                //Here we should have the set of all the keys to decrypt messages
                console.log(`Keys ${JSON.stringify(keys)}`);
                let metaIDs = new CuteSet(keys);
                let currentWrup = new WrapupRecord(this.getWrapupBlobSync(pkfp));
                //Gather all needed encrypted keys
                while (metaIDs.length() > 0){

                    let meta = this.getHistoryElementSync(currentWrup.getLastMetadataSize(),
                        currentWrup.lastMetadataStart, pkfp).toString();
                    meta = JSON.parse(meta);
                    console.log("Obtained and parsed metadata. ID: " + meta.body.id);


                    if (metaIDs.has(meta.body.id)){
                        try{
                            console.log("Meta ID found, setting the key! ");
                            res[meta.body.id] =  meta.body.participants[pkfp].key;
                            metaIDs.remove(meta.id)
                        }catch(err){
                            console.log("Error obtaining the key from message: " + err);
                        }
                    }
                    let currentEndWrup = currentWrup.lastMetadataStart;
                    if (currentEndWrup<=0) break;
                    currentWrup = new WrapupRecord(this.getWrapupBlobSync(pkfp, currentEndWrup))
                }
                resolve(res)
            }catch(err){
                reject(err);
            }
        })

    }

    loadMoreMessages(pkfp = Err.required(), lastLoadedMessageID, numberOfMessages = 10){
        return new Promise((resolve, reject)=>{
            try{
                let messages = [];
                let keys = new CuteSet();
                //      console.log("Initializing wrup");
                let currentWrup = new WrapupRecord(this.getWrapupBlobSync(pkfp));
                //       console.log("Done Initializing wrup: " + currentWrup.lastMetadataEnd);
                let currentEndWrup;

                let allLoaded = false; // Flag whether all messages have been loaded already

                if(currentWrup.lastMessageEnd === 0){
                    allLoaded = true;
                    resolve([ [],  keys, allLoaded ]);
                    console.log("No messages! Returning...");
                    return;
                }

                let lastMessageSeen = false; //Flag whether last message has been seen already

                for(let i=0; i<numberOfMessages; ++i){
                    let message = this.getHistoryElementSync(currentWrup.getLastMessageSize(),
                        currentWrup.lastMessageStart, pkfp).toString();
                    //Gathering all the metadata ids to get the keys later
                    //console.log("Got a message " + message + " \nwrup " + currentWrup.toBlob());

                    let parsedMessage = JSON.parse(message);


                    if(parsedMessage.header.service){
                        messages.push(message);
                        currentEndWrup = currentWrup.lastMessageStart;
                        currentWrup = new WrapupRecord(this.getWrapupBlobSync(pkfp, currentEndWrup));
                        if (currentWrup.lastMessageStart === 0 && currentWrup.lastMessageEnd === 0){
                            allLoaded = true;
                            break;
                        }
                        continue;
                    }

                    //If need to load messages after the last loaded message:
                    if (lastLoadedMessageID && !lastMessageSeen){

                        if (lastLoadedMessageID === parsedMessage.header.id){
                            lastMessageSeen = true;
                        }
                        //Set wrapup record to next message, reset counters, continue looping until find last loaded message
                        currentEndWrup = currentWrup.lastMessageStart;
                        currentWrup = new WrapupRecord(this.getWrapupBlobSync(pkfp, currentEndWrup));
                        i=0;
                        if (currentWrup.lastMessageStart === 0 && currentWrup.lastMessageEnd === 0){
                            allLoaded = true;
                            break;
                        }
                        continue;

                    }
                    let metadataID =parsedMessage.header.metadataID;
                    if(metadataID){
                        keys.add(metadataID);
                    }
                    messages.push(message);

                    currentEndWrup = currentWrup.lastMessageStart;
                    currentWrup = new WrapupRecord(this.getWrapupBlobSync(pkfp, currentEndWrup));
                    if (currentWrup.lastMessageStart === 0 && currentWrup.lastMessageEnd === 0){
                        allLoaded = true;
                        break;
                    }

                }
                resolve([messages, keys, allLoaded]);
            }catch(err){
                console.trace("Error getting last messages: " + err);
                reject(err)
            }

        })
    }


    appendMetadata(blob, pkfp){
        let queue = this.getAppendQueue(pkfp);
        queue.enqueue(this._prepareAppendMetadataJob(blob, pkfp));
        return queue.run();
    }


    _prepareAppendMetadataJob(blob, pkfp){
        return function(){
            return new Promise((resolve, reject)=>{
                let hm = this.hm;
                let pkfp = this.pkfp;
                let blob = this.blob;
                console.log("Appending metadata. pkfp: "+ pkfp);
                hm.getWrapupBlob(pkfp)
                    .then(wrapupBlob =>{
                        let wrup = new WrapupRecord(wrapupBlob);
                        let start = hm.getHistorySize(pkfp);
                        let end = start + blob.length;
                        wrup.setLastMetadata(start, end);
                        let newRecord = blob + wrup.toBlob();
                        return hm._appendHistory(pkfp, newRecord);
                    })
                    .then(()=>{
                        resolve()
                    })
                    .catch(err =>{
                        reject(err)
                    })
            })


        }.bind({blob: blob, pkfp: pkfp, hm: this})
    }





    appendMessage(blob, pkfp){
        let queue = this.getAppendQueue(pkfp);
        queue.enqueue(this._prepareAppendMessageJob(blob, pkfp));
        return queue.run();
    }

    _prepareAppendMessageJob(blob, pkfp){
        return function (){
            return new Promise((resolve, reject)=>{
                let hm = this.hm;
                hm.getWrapupBlob(this.pkfp)
                    .then(wrapupBlob =>{
                        let wrup = new WrapupRecord(wrapupBlob);
                        let start = hm.getHistorySize(this.pkfp);
                        let end = start + this.blob.length;
                        wrup.setLastMessage(start, end);
                        let newRecord = this.blob + wrup.toBlob();
                        return hm._appendHistory(this.pkfp, newRecord);
                    })
                    .then(()=>{
                        console.log("Message was appended successfully.");
                        resolve();
                    })
                    .catch(err =>{
                        reject(err);
                    })
            })
        }.bind({blob:blob, pkfp:pkfp, hm: this});
    }


    getPendingInvites(pkfp){
        return new Promise((resolve, reject)=>{
            try{
                let invitePath = this.pathToInvites(pkfp);
                if (!fs.existsSync(invitePath)){
                    resolve();
                    return;
                }
                let result = {};
                fs.readdir(invitePath, (err, files)=>{
                    for(let file of files){
                        result[file] = fs.readFileSync(path.join(invitePath , file), 'utf8')
                    }
                    resolve(JSON.stringify(result));
                })
            }catch(err){
                console.log("Error getting pending invites " + err);
                reject(err);
            }
        });
    }

    _appendHistory(pkfp, blob){
        return new Promise((resolve, reject)=>{
            let  path = this.pathToHistory(pkfp)
            console.log("Appending file!");
            fs.appendFile(path, blob, (err)=>{
                if (err) {
                    reject(err);
                } else{
                    resolve();
                }
            });
        });
    }

    _appendTAMetadata(pkfp, blob){
        return new Promise((resolve, reject)=>{
            let path = this.getPath(pkfp, "taMetadata");
            fs.appendFile(path, blob, (err)=>{
                if (err) {
                    reject(err);
                } else{
                    resolve();
                }
            });
        })
    }

    /**
     * Sets specified topic key
     * see self.topicKeyPaths for available topic key types
     * @param pkfp
     * @param keyType
     * @param keyData
     */
    setTopicKey(pkfp = Err.required("saveTopicKey: pkfp"),
                 keyType = Err.required("saveTopicKey: keyType"),
                 keyData = Err.required("saveTopicKey: keyData")){
        if (!this.topicKeyPaths.hasOwnProperty(keyType)){
            throw new Error("saveTopicKey: invalid key type: " + keyType)
        }
        let pathToKey = this.getKeyPath(pkfp, keyType);

        if (fs.existsSync(pathToKey)){
            fs.unlinkSync(pathToKey)
        }

        fs.writeFile(pathToKey, keyData, (err)=>{
            if (err) throw err;
            console.log("Private key written successfully");
        });
    }


    /**
     * Finds and returns specified topic key
     * @param pkfp
     * @param keyType
     */
    async getTopicKey(pkfp = Err.required("getTopicKey: pkfp"),
                keyType = Err.required("getTopicKey: keyType")){

        if (!this.topicKeyPaths.hasOwnProperty(keyType)){
            throw new Error("getTopicKey: invalid key type: " + keyType)
        }
        let pathToKey = this.getKeyPath(pkfp, keyType);

        if (!fs.existsSync(pathToKey)){
            throw new Error("History manager getTopicKey Error: Key is not found.")
        }
        console.log("About to get topic key path: " + pathToKey);
        let data = await fs.readFile(pathToKey);
        return data.toString();
    }

    async deleteTopic(pkfp){
        let path =  this.getPath(pkfp, "topicRoot");
        await fs.remove(path)
    }


    async taSaveInviteIndex(taPkfp, data){
        let path = this.getPath(taPkfp, "inviteIndex");
        if (await fs.exists(path)){
            await fs.unlink(path);
        }

        await fs.writeFile(path, data);
    }

    async taLoadInviteIndex(taPkfp){
        let path = this.getPath(taPkfp, "inviteIndex");
        if(await fs.exists(path)){
            let data = await fs.readFile(path);
            return data.toString();
        }
    }


    /**
     * Writes encrypted hidden service private key
     * @param pkfp
     * @param privateKey - encrypted key data
     * @private
     */
    _setHSClientKey(pkfp, privateKey){
        let pathToKey = this.pathToHSPrivateKey(pkfp);
        if (fs.existsSync(pathToKey)){
            fs.unlinkSync(pathToKey)
        }
        fs.appendFile(pathToKey, privateKey, (err)=>{
            if (err) throw err;
            console.log("Private key written successfully");
        });
    }


    _setTopicKey(pkfp, privatreKeyData){
        let pathToKey = this.getKeyPath(pkfp, "taPrivateKey");
        if (fs.existsSync(pathToKey)){
            fs.unlinkSync(pathToKey)
        }
        fs.appendFile(pathToKey, privatreKeyData, (err)=>{
            if (err) throw err;
            console.log("Private key written successfully");
        });
    }

    getHistorySize(pkfp){
        return fs.statSync(this.pathToHistory(pkfp)).size;
    }

    taGetMetadataSize(taPkfp){
        return fs.statSync(this.getPath(taPkfp, "taMetadata")).size;
    }


    //TODO
    /***** REFACTORING NEEDED!!! *******************/
    pathToHistory(pkfp = Err.required("Path to history")){
        return path.join(this.historyDirectory , pkfp , "history_store");
    }

    pathToInvites(pkfp = Err.required("pkfp - pathToInvites")){
        return this.getPath(pkfp, "invites");
    }



    pathToHSPrivateKey(pkfp = Err.required("Path to history")){
        return path.join(this.historyDirectory , pkfp , "owner_hs_private_key");
    }

    pathToOwnerPublicKey(pkfp = Err.required("Path to history")){
        return path.join(this.historyDirectory , pkfp , "owner_public_key");
    }

    pathToAttachments(pkfp = Err.required(('pathToAttachments'))){
        return path.join(this.historyDirectory , pkfp , "files");
    }

    /**
     * Returns path to specified history object (file or folder)
     * @param pkfp
     * @param {String} pathTo - specifies the object path requested to
     *          It must be in self.commonPaths
     *
     */
    getPath(pkfp = Err.required('getPath: pkfp'),
            pathTo = Err.required('getPath: pathTo')){
        if(!this.commonPaths.hasOwnProperty(pathTo)){
            throw("error getPath: invalid history object: "  + pathTo)
        }

        return path.join(this.historyDirectory , pkfp , this.commonPaths[pathTo])
    }

    getKeyPath(pkfp = Err.required('getPath: pkfp'),
            pathTo = Err.required('getPath: pathTo')){
        if(!this.topicKeyPaths.hasOwnProperty(pathTo)){
            throw("error getPath: invalid history object: "  + pathTo)
        }

        return path.join(this.historyDirectory , pkfp , this.topicKeyPaths[pathTo])
    }

    isTopicExist(pkfp){
        return fs.existsSync(path.join(this.historyDirectory , pkfp));
    }

    isHistoryExist(pkfp){
        return fs.existsSync(path.join(this.historyDirectory , pkfp , "history_store"));
    }

    async fixHistory(pkfp){
        let historyFixer = new HistoryFixer("this.historyDirectory" + pkfp,  "history_store")
        await historyFixer.fixHistory();
        await historyFixer.finalize();
    }

}





module.exports  = HistoryManager;
