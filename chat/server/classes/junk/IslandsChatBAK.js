const iCrypto = require('./libs/iCrypto');
const HistoryManager = require('./libs/HistoryManager');
const TopicAuthority = require("./objects/TopicAuthority.js");
const fs = require('fs');
const SocketIO = require('socket.io');
const ss = require('socket.io-stream');
const Metadata = require("./objects/Metadata.js");
const Err = require("./libs/IError.js");




//DEV
let CircularJSON = require('circular-json');
//END DEV


const Torconn = require('./libs/TorConnector');

/**
 * manages connectors
 * provides interface for history manager
 * bootstraps ws listeners to provided server
 */


class IslandsChat{
    /**
     *
     * @param server
     * @param opts
     *  connector:String Default tor connector
     *  path to history folder: String
     *  onion address
     */
    constructor(server, opts){

        //prepare History Path
        let historyPath = (opts ? opts.historyPath : null);

        this.basePath = (opts ? opts.basePath : "./");

        //init history manager
      //  this.hm = new HistoryManager(historyPath);

        //init tor connector
        this.connector = new Torconn(opts);
        this.setConnectorListeners();

        this.setClientRequestHandlers();

        // inter-island handlers
        this.setInterIslandHandlers();

        //init socket.io server
        this.io = SocketIO.listen(server);
        this.chatSocket = this.io.of('/chat');
        this.fileSocket = this.io.of('/file');

        this.setChatEvents();

        this.topicAuthorities = {};
        /**
         * Maps socket.id -> session pkfp
         * @type {{}}
         */
        this.socketSessionMapping = {};
        this.newTopicPending = {};
        this.pendingLogins = {};
        this.pendingInterIslandFileRequests = {};

        //Used by uploaderWorkers
        this.pendingUploads = {};

        /**
         * @type {Object}: Represents active client sessions
         *  Key: public key fingerprint of the client:
         *  Value: {Object}
         *      sessionID: hexNonce
         *      residence :.onion
         *      publicKey : ...
         *      pkfp: publicKeyFingerprint
         *      sockets: Array [socket, socket...] //So single session supports multiple connections
         *              from multiple devices or browser tabs
         *      participants: Object{ key: pkfp, value: residence}
         *             //Topic participants other than client for message addressing
         */
        this.activeSessions = {};
   //     this.loadActiveSessions();
        this.pendingTopicJoins = {};
//        this.loadPendingTopicJoins();
        this.setClientErrors()


    }

    /******************************************
     * GENERIC ERROR HANDLER
     ******************************************/
    setClientErrors(){
        this.clientErrors = {
            uploadError: "upload_error",
            downloadError: "download_error",
            initTopicError: "init_topic_fail",
            initHistoryError: "init_history_fail",
            loginError: "login_fail",
            loadMoreMessagesError: "load_more_messages_fail",
            initInviteError: "init_invite_fail",
            saveInviteError: "save_invite_fail",
            updateInviteError: "update_invite_fail"
        };
    }

    returnClientError(socket, errorType, errorMsg, request){
        let msg;
        if( errorMsg instanceof Error){
            msg = errorMsg.message;
        } else{
            msg = errorMsg;
        }
        request.headers.response = errorType;
        request.headers.error = msg;
        socket.emit("response", request)
    }

    /***** EVENT LISTENERS *******/
    setConnectorListeners(){
        this.connector.on("note", data =>{
            console.log("PROCESSING INTERISLAND NOTE");
            this.processInterIslandNote(data.note, data.socketID)
        });

        this.connector.on("request", data =>{
            this.processInterIslandRequest(data.request, data.socketID);
        });

        this.connector.on("response", data =>{
            this.processInterIslandResponse(data.response, data.socketID);
        });


        this.connector.on("message", (data)=> {
            this.processIncomingMessage(data.message, data.socketID);
        });

        this.connector.on("connection_established", onion=>{
            console.log("TOR CONNECTOR: Connection established with " + onion);

        });

        this.connector.on("get_file", (socket, data)=>{
            this.processInterIslandGetFileRequest(socket, data);
        });

        this.connector.on("unidentified_connection_established", socketID=>{
            console.log("TOR CONNECTOR: GOT UNIDENTIFIED CONNECTION FROM TOR: " + socketID);
        })
    }

    setChatEvents(){
        this.chatSocket.on('connection', (socket) => {
            this.setClientSocketListeners(socket);
        });

        this.fileSocket.on('connection', (socket)=>{
            console.log("File socket connected");

            //init new worker

            this.setFileSocketEventListeners(socket)
        })

        //TODO on disconnect

    }

    setPendingInterIslandFileRequest(tempName, data){
        this.pendingInterIslandFileRequests[tempName] = data
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
                    this.hm.deleteFileOnTransferFail(data.pkfpDest, data.name);
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
            console.log("File not found");
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

                //if success - request file
                let stream =  self.hm.createAttachmentFileStream(data.myPkfp, tempName);
                await self.transferAndVerifyFileFromPeer(socket, stream, data, data.hashEncrypted, data.signEncrypted, data.pubKey)
                console.log("Renaming temp file");
                self.hm.renameTempUpload(data.myPkfp, tempName, data.link.name);
                //All set. File transferred from peer
                resolve()
            }catch(err){
                reject(err);
            }
        })
    }

    getAttachmentFileHash(pkfp, fileName, hashAlgorithm = "sha256"){
        return new Promise(async (resolve, reject)=>{
            console.log("Calculating attachment file hash: pkfp: " + pkfp+" filename: " + fileName );
            let self = this;
            let readStream = self.hm.createAttachmentFileStream(pkfp, fileName, "r");
            let ic = new iCrypto();
            ic.createHash("h", hashAlgorithm);

            readStream.on("error", err=>{
                reject(err);
            });

            readStream.on("readable", ()=>{
                let chunk;
                while(null !== (chunk = readStream.read())){
                    ic.updateHash("h", new Uint8Array(chunk));
                }
            });

            readStream.on("end", ()=>{
                ic.digestHash("h", "hres");
                resolve(ic.get("hres"));
            })
        })
    }

    /**
     * Given signature and hash finds the file,
     * calculates its hash, verifies the signature
     * and resolves with object result: true/false, err: err
     * @param pkfp
     * @param filename
     * @param sign
     * @param metaID
     * @returns {Promise<any>}
     */
    verifyAttachmentFile(topicOwnerPkfp, fileOwnerPublicKey, filename, hash,  sign){
        return new Promise(async (resolve, reject)=>{
            let self = this;
            try{
                //Calcluate hash of existing file
                let publicKey = fileOwnerPublicKey;
                let calculatedHash = await self.getAttachmentFileHash(topicOwnerPkfp, filename);

                if(calculatedHash !== hash){
                    let errMsg = "verifyAttachmentFile: passed hash does not match calculated hash\nCalculated hash: " + calculatedHash+"\nPassed hash: " + hash;

                    reject(errMsg);
                    return;
                }

                //check signature of the hash
                let ic = new iCrypto();
                ic.addBlob("h", hash)
                    .hexToBytes("h", "hraw")
                    .asym.setKey("pubk", publicKey, "public")
                    .addBlob("sign", sign)
                    .publicKeyVerify("h", "sign", "pubk", "vres");

                if(!ic.get("vres")){
                    let errMsg = "verifyAttachmentFile: Signature error";
                    console.log(errMsg);
                    reject(errMsg)
                }else{
                    console.log("Attachment is verified");
                    resolve()
                }

            }catch(err){
                reject("verifyAttachmentFile:  " + err);
            }

        })
    }

    /**
     * The socket is connection between browser and island
     * This connection is solely for file transfers
     * @param socket
     */
    setFileSocketEventListeners(socket){
        let self = this;
        let hashUnencrypted;
        ss(socket).on('upload_attachment', async (stream, data)=>{
            let bytesReceived = 0;
            let ic = new iCrypto();
            ic.createHash("h");
            console.log("Received file. Verifying request...");
            let verified = await self.verifyNonce(data.pkfp, data.nonce, data.sign, true);
            if (!verified){
                interruptOnError(socket, "invalid_request");
            } else{
                let tempFileName = data.nonce + ".temp";
                let fileStream = self.hm.createAttachmentFileStream(data.pkfp, tempFileName);
                stream.on("finish", ()=>{
                    console.log("Received end of stream. HashUnencrypted set to " + hashUnencrypted)
                    ic.digestHash("h", "hres");
                    console.log("HASH encrypted is " + ic.get("hres"));;
                    let tempName = data.nonce + ".temp";
                    try{
                        console.log("About to rename");
                        self.hm.renameTempUpload(data.pkfp, tempName, hashUnencrypted);
                        socket.emit("upload_success");
                    }catch(err){
                        console.error("Error on finalize_upload: " + err);
                        interruptOnError(socket, "upload_error", err.message);
                    }
                });

                stream.on("data", (chunk)=>{
                    bytesReceived += chunk.byteLength;
                    console.log(new Uint8Array(chunk.slice(0, 32)).toString())
                    ic.updateHash("h", chunk);
                    fileStream.write(chunk);
                });
                console.log("Request verified. Stream created. emitting upload_ready");
                socket.emit('upload_ready')
            }
        });

        socket.on("finalize_upload", data=>{
            console.log("Finalize upload called setting hashUnencrypted to " + data.hashUnencrypted);
            hashUnencrypted = data.hashUnencrypted;
            console.log("Hash set. Now ready to end stream");
            socket.emit("end_stream")
        });


        /**
         * Interrupting download or upload process in case of error
         *
         * @param socket
         * @param command
         * @param data
         */
        const interruptOnError = (socket, command, data)=>{
            socket.emit(command, data);
        };



        socket.on('download_attachment', async (data)=>{
            console.log("Got download_attachment request");
            // If requested file found locally - just push it to the client browser
            let link = data.link;
            let myPkfp = data.myPkfp;
            let fileOwnerPublicKey = await self.hm.getParticipantPublicKey(myPkfp, link.pkfp);
            if (self.hm.fileExists(myPkfp, link.name)){
                try{
                    await self.verifyAttachmentFile(link.pkfp, fileOwnerPublicKey, link.name, data.hashEncrypted, data.signEncrypted);
                }catch(err){
                    console.log("Verification error: " + err);
                    interruptOnError(socket, "download_error", err.message);
                    return;
                }
                let key = await self.hm.getSharedKeysSet([data.metaID], myPkfp);
                console.log("File found locally. Notifying client...");
                socket.emit("download_ready", key);

            } else {
                //Trying to get file from peer

                socket.emit("requesting_peer");
                console.log("File not found locally. Trying to get it from the owner");
                data.pubKey = fileOwnerPublicKey;
                try{
                    await self.getFileFromPeer(data)
                    let key = await self.hm.getSharedKeysSet([data.metaID], myPkfp);
                    console.log("File successfully obtained and can be transferred to client. Notifying...");
                    socket.emit("download_ready", key);
                }catch(err){
                    interruptOnError(socket, "download_error", err.message);
                    return;
                }

            }
        });

        /**
         * If this event received - it means that all the
         * islands checks were completed and file is available for download
         * So we just start pumping the data
         */
        socket.on("proceed_download", (data)=>{
            console.log("Proceeding download received");

            let link = data.link;
            let mypkfp = data.pkfp;
            let stream = ss.createStream();
            console.log(data.pkfp + "  |  " + link.name);
            let fileStream = self.hm.createAttachmentFileStream(mypkfp, link.name, "r");
            ss(socket).emit("file", stream);


            fileStream.on("readable", ()=>{
                let chunk;
                while(null !== (chunk = fileStream.read())){
                    console.log("SENDING CHUNK: "  + new Uint8Array(chunk.slice(0, 32)));
                    stream.write(chunk);
                }
            });

            fileStream.on("end", ()=>{
                stream.end();
            })

        });

        socket.on('disconnect', ()=>{
            console.log("File socket disconnected");
        });



    }

    setClientSocketListeners(socket){
        console.log("Call from local client. Setting up the listeners...");

        socket.on("disconnect", (reason)=>{
           this.processDisconnect(reason, socket);
        });

        socket.on("request", (request)=>{
            this.processClientRequest(request, socket);
        });

        socket.on("response", (response)=>{
            this.processClientResponse(response, socket);
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log("Successfull reconnect: attempt " + attemptNumber);
        });

    }
    /***** END EVENT LISTENERS *******/

    /*** REQUESTS AND MESSAGES PROCESSING ****/
    /**
     * The parameters for all the functions are:
     *  {Message} request
     *  {Object} socket
     *  {Object} self
     */
    setClientRequestHandlers(){
        this.clientRequestHandlers = {
            new_topic_get_token: this.initTopicCreateToken,
            init_history: this.initHistory,
            init_topic: this.initTopic,
            init_login: this.initLogin,
            login_data_decrypted: this.continueLoginAfterDataDecryption,
            init_session: this.initSession,
            load_more_messages: this.loadMoreMessages,
            boot_participant: this.bootParticipant,
            join_topic: this.joinTopicOutgoing,
            join_topic_get_info: this.joinTopicGetInfo,
            create_invite_request: this.processOutgoingInviteRequest,
            init_invite: this.initInvite,
            invite_set_invitee_name: this.inviteSetInviteeName,
            del_invite: this.delInvite,
            new_member_joined: this.newMemberJoined,
            save_new_invite: this.saveNewInvite,
            shout_message: this.shoutMessage
        };

        this.clientResponseHandlers = {
            join_topic_invitee_info: this.sendInviteeInfo
        }
    }

    setInterIslandHandlers(){

        console.log("Setting interisland handlers...");
        this.interIslandRequestHandlers = {
            join_topic: this.joinTopicIncoming,
            join_topic_get_info: this.processJoinTopicGetInfoRequest,
            new_member_joined: this.updateMetaOnMemberJoin,
            create_invite_request: this.processIncomingCreateInviteRequest,
            boot_participant: this.participantBooted
        };

        this.interIslandResponseHandlers = {
            join_topic_invitee_info: this.inviteeInfoProceedJoin
        };

        this.interIslandNoteHandlers = {
            u_booted: this.youWereBooted
        };

        this.interIslandMessageHandlers = {

        };

        this.interIslandErrorHandlers = {

        };
    }

    processClientRequest(request, socket){

        try{
            (this.clientRequestHandlers.hasOwnProperty(request.headers.command)) ?
                this.clientRequestHandlers[request.headers.command](request, socket, this) :
                this.processInvalidClientRequest(request, socket, this)
        }catch(err){
            this.processClientRequestError(request, socket, err, this)
        }

    }

    processClientResponse(response, socket){
        this.clientResponseHandlers.hasOwnProperty(response.headers.response) ?
            this.clientResponseHandlers[response.headers.response](response, socket, this) :
            this.processInvalidClientRequest(response, socket)
    }

    processDisconnect(reason, socket){
        console.log("Processing client disconnect...");
        let pkfp = this.socketSessionMapping[socket.id];
        if (!pkfp) return;
        let session = this.activeSessions[pkfp];
        for(let i=0; i<session.sockets.length; ++i){
            if (session.sockets[i].id ===socket.id){
                console.log("Processing discopnnect: socket found and deleted from the session");
                session.sockets.splice(i);
            }
        }
        //TODO Send note to all participants that client went offline
        this.notifyAll("user_disconnected", pkfp);
        if(session.sockets.length === 0){
            console.log("No more active sockets. Deleting the session...");
            delete this.activeSessions[pkfp];
        }
    }

    //TODO implement notification mechanism
    notifyAll(note, issuerPkfp){
        console.log("About to broadcast notification: " + note);
    }

    /**
     * Processing invalid request
     * @param request
     * @param socket
     */
    processInvalidClientRequest(request, socket){
        let response = new Message(request);
        response.error = "Invalid request";
        socket.emit("response", response);
    }

    processInvalidInterIslandRequest(request, socketID){
        console.log("Error: Invalid interisland request!");
    }

    processInvalidInterlandResponse(request, socketID){
        console.log("Error: Invalid interisland response!");
    }

    processInterIslandRequest(envelope, socketID){
        let request = envelope.message;
        console.log("Got new interisland request. SocketID " + socketID);
        this.interIslandRequestHandlers.hasOwnProperty(request.headers.command) ?
            this.interIslandRequestHandlers[request.headers.command](request, socketID, this) :
            this.processInvalidInterIslandRequest(request, socketID, this);
    }

    processInterIslandResponse(envelope, socketID){
        let response = envelope.message;
        console.log("Got new interisland response: " + JSON.stringify(response) + " socketID" + socketID);
        this.interIslandResponseHandlers.hasOwnProperty(response.headers.response) ?
            this.interIslandResponseHandlers[response.headers.response](response, socketID, this) :
            this.processInvalidInterlandResponse(response, socketID, this)
    }

    processInterIslandNote(envelope, socketID){
        let note = envelope.message;
        this.interIslandNoteHandlers.hasOwnProperty(note.headers.command) ?
            this.interIslandNoteHandlers[note.headers.command](note, socketID, this) :
            this.interIslandNoteHandlers.default(note, socketID, this);

    }
    /***********END REQUESTS AND MESSAGES PROCESSING *********************/


    /******************************************
     * ERROR HANDLING
     *****************************************/

    processClientRequestError(){

    }

    /******************************************
     * END ERROR HANDLING
     *****************************************/


    /****** INVITE AND JOIN TOPC *********/

    async processOutgoingInviteRequest(request, socket, self){
        //Verify request sender
        console.log("Processing invite request");
        let publicKey = await self.hm.getOwnerPublicKey(request.headers.pkfpSource);
        let verified = await self.verifyClientRequest(request);
        let metadata = JSON.parse(await self.hm.getLastMetadata(request.headers.pkfpSource));

        let onionSource = metadata.body.participants[request.headers.pkfpSource].residence;
        let onionDest = metadata.body.topicAuthority.residence;

        //send invite generate request
        try{
            let envelope = new Envelope(request, onionDest,"request" , onionSource)
            await self.connector.send(envelope);
        }catch(err){
            self.returnClientError(socket,
                self.clientErrors.loginError,
                "invite request error: " + err,
                request);
        }
    }

    processIncomingCreateInviteRequest(envelope, socketID){
        console.log("Received interisland create invite request");
    }

    /**
     * Inviter requests nickname and residence from invitee
     * @param request
     * @param socketID
     */
    joinTopicGetInfo(request, socket, self){
        //Send it via tor
        //request should have following: {request:request, socketID: socketID}
        let pendingRequest = self.pendingTopicJoins[request.body.socketID];

        if (!pendingRequest){
            request.headers.error = "Pending request is not found";
            request.headers.response = "error";
            socket.emit('response', request);
            console.log("Error: Pending topic join request was not found");
            return;
        }

        let envelop = new Envelope(request, pendingRequest.socketID, "request");
        console.log("Sending joinTopicGetInfo request...");
        self.connector.send(envelop)
            .then(()=>{
                console.log("Message sent attempt through tor was successful");
            })
            .catch((err)=>{
                console.log("Error during sending message through TOR: " + err);
            })
    }

    /**
     * Called by inviter after receiving the rest of the
     * data from the invitee. Appends new metadata blob to the history file
     * and sends metadata update to all topic members.
     * @param request
     * @param socket
     * @param self
     */
    newMemberJoined(request, socket, self){
        //append new meta block
        let metaBlob = request.body.metadata;
        let participants = JSON.parse(metaBlob).public.participants;
        let mypkfp = request.headers.pkfpSource;
        let me = participants[mypkfp];
        self.hm.appendMetadata(metaBlob, mypkfp)
            .then(()=>{
                return self.consumeInvite(mypkfp, request.body.inviteCode, request.body.inviteHSID)
            })
            .then(()=>{
                let promises = [];
                let pkfps = Object.keys(participants);
                console.log("PARTICIPANTS: " + pkfps);
                for(let i=0; i<pkfps.length; ++i){

                    if(pkfps[i] === mypkfp) {
                       // console.log("that's me... not sending to myself, continuing....");
                        continue;
                    }
                    //Setting destination pkfp
                    request.headers.pkfpDest = pkfps[i];
                    //Setting destination onion
                    let envelope = new Envelope(request, participants[pkfps[i]].residence, "request", me.residence);

                    promises.push(self.connector.send(envelope));
                }
                return Promise.all(promises)
            })
            .then(()=>{
                 return self.hm.getPendingInvites(mypkfp)
            })
            .then((pendingInvites)=>{
                let response = new Message();
                response.headers.response = "topic_join_meta_sent";
                response.body.invites = pendingInvites;
                socket.emit("response", response);
            })
            .catch(err =>{
                console.log("topic_join_meta_send_fail" + err);
                let response = new Message();
                response.headers.response = "topic_join_meta_send_fail";

                response.headers.error = err;
                socket.emit("response", response);
            })

    }

    /**
     * Processes inviter's request to send nickname
     * and residence of the new member. Receives the request, and passes it
     * to the new member's browser if it is online.
     * @param request
     * @param socketID
     * @param self
     */
    processJoinTopicGetInfoRequest(request, socketID, self){
        //Save in cache on server
        console.log("processJoinTopicGetInfoRequest: request: " + request);
        let pendingRequest = self.pendingTopicJoins[request.body.inviteCode];

        if (pendingRequest){
            /**
             * pendingRequest: {
             *      socketID,
             *      inviteePublicKey
             * }
             */
            try{
               // console.log("Pending request: "  + CircularJSON.stringify(pendingRequest));
                console.log("Pending request found. Passing to client...");

                let inviteeSocket = self.chatSocket.sockets[pendingRequest.socketID];
                inviteeSocket.emit("request", request);
            } catch(err){
                console.log(err);
                //emit error
            }
        } else{
            console.log("Pending topic joins: "+JSON.stringify(self.pendingTopicJoins));
            console.log("pending request not found... ")
            //emit error
        }
    }

    /**
     * Request from client to send invitee info and init new topic
     * part of joining topic process
     *
     * @param request
     * @param socket - client socket that request was sent from
     * @param self
     */
    sendInviteeInfo(request, socket, self){
        console.log("Sending invitee info and initializing new topic");
        let inviterResidence = request.body.inviterResidence;
        let myResidence = request.body.hs.onion;
        let myPkfp = request.body.invitee.pkfp;
        let hsPrivateEnc = request.body.hs.privateKeyEncrypted;
        let hsPrivateRaw = request.body.hs.privateKeyRaw;
        let inviterPublicKey =  request.body.inviterPublicKey;
        let inviteCode = request.body.inviteCode;
        let requestToInviter = new Message();
        requestToInviter.headers = request.headers;
        requestToInviter.body = request.body.messageToInviter;
        //connect to inviter onion
        let envelop = new Envelope(requestToInviter, inviterResidence, "response", myResidence);
        self.connector.callPeer(inviterResidence, myResidence)
            .then(()=>{
                //After connection established init topic
                return self.hm.initTopic(myPkfp, hsPrivateEnc)
            })
            .then(()=>{
                //send him stuff
                return self.connector.send(envelop);
            })
            .then(()=>{
                //launch hidden service
                return self.connector.createHiddenService(hsPrivateRaw, true)
            })
            .then((data)=>{
                let messages = data.messages;
                if (myResidence !== messages.ServiceID + ".onion"){
                    console.log("INVALID HIDDEN SERVICE WAS CREATED. Precalculated: " + myResidence + " actual: " + messages.ServiceID + ".onion");
                    throw new Error("INVALID HIDDEN SERVICE WAS CREATED. Precalculated: " + myResidence + " actual: " + messages.ServiceID + ".onion");
                }
                if(!self.pendingTopicJoins[inviteCode]){
                    throw new Error("Pending topic join was not found!!!");
                }
                self.pendingTopicJoins[inviteCode].inviterPublicKey = inviterPublicKey;
                console.log("Saved inviter's public key in pending topic joins: " + inviterPublicKey);
            })
            .catch(err =>{
                console.error("Error sending invitee info to inviter: " + err);
            })
    }

    /**
     * On the inviter's side receives additional new member's info
     * and passes it along to the inviter for future processing
     * @param response
     * @param socketID
     * @param self
     */
    inviteeInfoProceedJoin(response, socketID, self){
        console.log("Got invitee info. Passing to the inviter. Response: " + JSON.stringify(response.headers));
        //TODO verify data
        let socket = self.activeSessions[response.headers.pkfpDest].sockets[0]
        socket.emit("response", response);
    }

    /**
     * TODO NEED TO REFACTOR THIS ONE BADLY!
     * @param request
     * @param socketID
     * @param self
     */
    updateMetaOnMemberJoin(request, socketID, self) {
        //Validate message,
        console.log("===================Got update meta on member join request==================");
        let newMetadata = JSON.parse(request.body.metadata);
        let mypkfp = request.headers.pkfpDest;
        let inviterPkfp = request.headers.pkfpSource;
        let inviteCode = request.body.inviteCode;
        let signature = request.body.metadataSignature;

        console.log("mypkfp: " + mypkfp);
        console.log("inviterPkfp: " + inviterPkfp);
        console.log("inviteCode: " + inviteCode);
        //console.log("newMetadata: " + JSON.stringify(newMetadata));
        console.log("signature: " + signature);


        if (self.hm.isHistoryExist(mypkfp)) {
            //not invitee. Just appending new meta and sending it to client
            //if online
            self.hm.getLastMetadata(mypkfp)
                .then(blob=>{
                    let curParticipants = JSON.parse(blob).public.participants;
                    let ic = new iCrypto()
                    console.log("Current participant" + curParticipants[inviterPkfp].publicKey);
                    ic.setRSAKey("pubInviter", curParticipants[inviterPkfp].publicKey, "public")
                        .addBlob("sign", signature)
                        .addBlob("public", JSON.stringify(newMetadata.public))
                        .addBlob("prenc", JSON.stringify(newMetadata.privateEncrypted))
                        .merge(["public", "prenc"], "gblob")

                        //.publicKeyVerify("gblob", "sign", "pubInviter", "res");
                    /*
                    if (!ic.get("res")){
                        //ATTACK DETECTED!.. or something screwed up
                        console.log("The new metadata and the signature was not verified. Aborting...");
                        return;
                    }
                    */
                    return self.hm.appendMetadata(request.body.metadata, mypkfp )
                })
                .then(()=>{
                    console.log("New metadata was appended successfully");
                    //EMIT TO CLIENT NEW META
                    let session = self.activeSessions[mypkfp];
                    if (session){
                        session.sockets[0].emit("request", request);
                    }
                })
                .catch(err =>{
                    console.log("Error appending new metadata: " + err);
                })
        } else if (self.pendingTopicJoins.hasOwnProperty(inviteCode)){
            console.log("Invite code found in pending topic joins on island");

            //This is invitee. Initializing
            let joinReq = self.pendingTopicJoins[inviteCode];
            console.log("Pending topic join: " + JSON.stringify(joinReq));
            let ic = new iCrypto();
            ic.setRSAKey("pubInviter", joinReq.inviterPublicKey, "public")
                .addBlob("sign", signature)
                .addBlob("public", JSON.stringify(newMetadata.public))
                .addBlob("prenc", JSON.stringify(newMetadata.privateEncrypted))
                .merge(["public", "prenc"], "gblob")
                .setRSAKey("mypub", joinReq.publicKey, "public")
                .getPublicKeyFingerprint("mypub", "mypkfp");
           //     .publicKeyVerify("gblob", "sign", "pubInviter", "res");
           // if (!ic.get("res")){
                //ATTACK DETECTED!.. or something screwed up
          //      console.log("The new metadata and the signature was not verified. Aborting...");
         //       return;
        //    }
            console.log("New metadata verified. Initializing history...");
            //All looks ok. Appending...
            self.hm.initHistory(ic.get("mypkfp"), request.body.metadata)
                .then(()=>{
                    //Notifying client
                    let socketID = self.pendingTopicJoins[inviteCode].socketID;

                    let socket = self.chatSocket.sockets[socketID];
                    if(socket && socket.connected){
                        socket.emit("request", request)
                    } else{
                        console.log("Socket looks offline. Notification was not delivered..");
                    }
                })
                .catch(err=>{
                    console.log("Error appending new metadata: " + err);
                })
        } else{
            //unable to find where to append metadata
            console.log("Unable to append metadata on member join. Either topic not found, or pending topic join not found");
            console.log("Invite code: " + inviteCode);
            console.log("Pending topic joins: " + CircularJSON.stringify(self.pendingTopicJoins));
            throw new Error("");
        }

        //let pendingRequest = self.pendingTopicJoins[request.body.inviteCode];
        //let inviteeSocket = self.chatSocket.sockets[pendingRequest.socketID];
        /**
         * pendingRequest: {
             *      socketID,
             *      inviteePublicKey
             * }
         */
    }

    /**
     * Processes request from client's browser to join remote topic
     * @param request
     * @param socket
     * @param self
     */
    joinTopicOutgoing(request, socket, self){
        console.log("Join topic outgoing request received from client");
        let envelop = new Envelope(request, request.headers.destination, "request");
        self.connector.send(envelop)
            .then(()=>{
                self.pendingTopicJoins[request.body.inviteCode] = {socketID: socket.id, publicKey: request.body.invitee.publicKey };
                console.log("Join request attempted to be sent successfully");
            })
            .catch((err)=>{
                console.log("Join request failed to be sent: " + err);
                throw err;
            })
    }


    /**
     * Processes request to join local topic from remote island
     * @param request
     * @param socket
     * @param self
     */
    joinTopicIncoming(request, socketID, self){
        //Check if inviter is online and can process join request
        let inviterSocket = self.getActiveSocket(request.headers.pkfpDest)
        if (!inviterSocket){
            //Send fail response

            let response = new Message(request);
            response.response = "join_topic_fail";
            response.error = "Inviter is offline";
            self.connector.send(new Envelope(response, socketID, "response"))
                .then(()=>{
                    console.log("Error message sent back to invitee");
                })
                .catch(err=>{
                    console.log("Error: " + err);
                    throw err
                })
        } else{
            console.log("Emiting join request to socket " + inviterSocket.id);
            inviterSocket.emit("request", request);
            //Saving incoming joint topic request with socket ID, so we can later respond

            self.pendingTopicJoins[request.body.inviteID] = {request:request, socketID: socketID}
        }
    }

    joinTopicRequest(inviteCode){
        return new Promise((resolve, reject)=>{
            let request = this.pendingTopicJoins[inviteCode];
            if (!request){
                reject("Join topic: request does not exists");
                return;
            }
            let destination = request.headers.destination;
            this.connector.send({
                message: request,
                destination: destination,
                type: "request"
            })
                .then(()=>{
                    console.log("Message sent");
                    resolve()
                })
                .catch(err=>{
                    console.log("JoinTopicRequest error: " + err);
                    reject(err);
                })
        })
    }
    /****** ~INVITE AND JOIN TOPC END ******/

    /****************************************************************
     *                      TOPIC INITIALIZATION
     ****************************************************************/





    /**
     * Initializes and save an instance of topicAuthority
     * result of this function must be running topicAuthority and its hidden service online
     * @param topicOwnerPkfp
     * @param taPrivateKey
     * @param taHsId
     */
    async launchTopicAuthority(topicOwnerPkfp, taPrivateKey, hsPrivateKey){
        console.log("Launching topic authority");
        let self = this;

        let taHsId = iCrypto.onionAddressFromPrivateKey(hsPrivateKey)
        if(!await self.connector.isHSUp(taHsId)){
            if(!hsPrivateKey){
                throw new Error("Hidden service with such id is not running. Hiddne service private key is required.");
            }
            let torResponse = self.connector.createHiddenService(hsPrivateKey, true);
            if(torResponse.messages.ServiceID.substring(0, 16) !== taHsId.substring(0, 16)){
                throw new Error("Invalid hidden service ID or private key");
            }
        }

        let topicAuthority = new TopicAuthority(
            topicOwnerPkfp,
            taPrivateKey,
            taHsId
        );
        self.topicAuthorities[topicAuthority.pkfp] = topicAuthority;
        return topicAuthority.pkfp;
    }

    /**
     * Returns topic authority, if launched
     * @param taPkfp
     * @returns {*}
     */
    getTopicAuthority(taPkfp = Err.required("Missing required parameter taPkfp")){
        return this.topicAuthorities[taPkfp];
    }

    /****************************************************************
     *                ~ END  TOPIC INITIALIZATION
     ****************************************************************/


    /****************************************************************
     *                TOPIC LOGIN INIT SESSION
     ****************************************************************/

    async initLogin(request, socket, self){

        //Respond to client in case of error
        let returnError = (err, request)=>{
            if (!request instanceof Message){
                request = new Message(request);
            }
            console.error("initLogin error: " + err);
            request.setResponse("login_fail");
            request.setError(err);
            socket.emit("response", request);
        };


        //Send HS private key for decryption

        try{
            let privateKeyCipher;
            request = new Message(request);

            //VALIDATE INFO, VERIFY CLIENT

            //Checking if such topic exists
            if (!self.hm.isTopicExist(request.headers.pkfpSource)){
                returnError("Topic was not identified with provided public key", request)
                return
            }

            let metadata = Metadata.parseMetadata(await self.hm.getLastMetadata(request.headers.pkfpSource))
            let clientPublicKey = metadata.body.participants[request.headers.pkfpSource].publicKey;
            let clientResidence = metadata.body.participants[request.headers.pkfpSource].residence;

            if(!Message.verifyMessage(clientPublicKey, request)){
                returnError("Request was not verified", request);
                return;
            }

            //Looks like all is good. Continuing...

            let topicAuthorityData, clientHSPrivateKey;

            //Save pending login
            self.pendingLogins[request.body.sessionID] = {
                request:request,
                clientPublicKey: clientPublicKey
            };

            let pendingLogin = self.pendingLogins[request.body.sessionID];

            if(request.headers.pkfpSource === metadata.body.owner && await self.taLaunchRequired(metadata)){
                topicAuthorityData = await self.getTopicAuthorityData(request.headers.pkfpSource, self);
                pendingLogin.taLaunchRequired = true;
            }
            if (!await self.connector.isHSUp(clientResidence)){
                console.log("Client hidden service launch required");
                clientHSPrivateKey = await self.hm.getTopicKey(request.headers.pkfpSource, "ownerHSPrivateKey")
                pendingLogin.clientHSLaunchRequired = true;
            }

            //IF any of topicAuthorityData and clientHSPrivateKey are defined
                //sending to client for decryption
            if(topicAuthorityData || clientHSPrivateKey){
                console.log("Topic authority launch required");
                let forDecryption = {
                    topicAuthorityData: topicAuthorityData,
                    clientHSPrivateKey: clientHSPrivateKey
                };
                self.loginSendDataForDecryption(request, socket, self, forDecryption)
                return;
            } else {
                await self.initSession(request, socket, self);
            }

            // request.body.metadata = metadata;
            //
            // ///ONLY TOPIC OWNER
            // let pendingInvites = await self.hm.getPendingInvites(request.headers.pkfpSource);
            // request.body.pendingInvites = pendingInvites;
            // let pkcip = await self.hm.getHSPrivateKey(request.headers.pkfpSource)
            // let ic = new iCrypto();
            // privateKeyCipher = pkcip;
            // ic = await ic.asym.asyncCreateKeyPair('kp', 1024);
            //
            // let AESlength = parseInt(privateKeyCipher.substr(privateKeyCipher.length-4));
            // let aes = privateKeyCipher.substring((privateKeyCipher.length - AESlength -4), privateKeyCipher.length-4);
            // let hiddenServicePrivateKeyEncrypted = privateKeyCipher.substring(0, (privateKeyCipher.length - AESlength -4));
            // request.body.hiddenService = {
            //     sym: aes,
            //     serverKey: ic.get('kp').publicKey
            // };
            //
            // self.pendingLogins[request.body.sessionID] = {
            //     request:request,
            //     key: ic.get('kp'),
            //     hspke: hiddenServicePrivateKeyEncrypted
            // };
            // request.headers.response = "init_login_success";
            // socket.emit("response", request);
        }catch(err){
            returnError(err, request);
        }
    }


    /**
     * Called ofter client decrypted data on island request and now
     * initializes Topic Authority if needed and launches all client hidden services
     * @param request
     * @param socket
     * @param self
     * @returns {Promise<void>}
     */
    async continueLoginAfterDataDecryption(request, socket, self){
        //Now we can launch topic authority, its hidden service and client hidden service.
        let decryptBlob = (privateKey, blob, lengthChars = 4)=>{
            let icn = new iCrypto();
            let symLength = parseInt(blob.substr(-lengthChars))
            let blobLength = blob.length;
            let symk = blob.substring(blobLength- symLength - lengthChars, blobLength-lengthChars );
            let cipher = blob.substring(0, blobLength- symLength - lengthChars);
            icn.addBlob("symcip", symk)
                .addBlob("cipher", cipher)
                .asym.setKey("priv", privateKey, "private")
                .asym.decrypt("symcip", "priv", "sym", "hex")
                .sym.decrypt("cipher", "sym", "blob-raw", true)
            return icn.get("blob-raw")
        };

        console.log("Continuing after data decryption");
        if (!self.pendingLogins[request.body.sessionID]){
            console.log("Login with such ID was not initiated");
            self.returnClientError(socket, "login_error", "Login with such ID was not initiated", request);
            return;
        }

        let pendingLogin = self.pendingLogins[request.body.sessionID]

        let clientPublicKey =  self.pendingLogins[request.body.sessionID].clientPublicKey;
        if (!Message.verifyMessage(clientPublicKey, request)){
            console.log("Message was not verified");
            self.returnClientError(socket, "login_error", "Login with such ID was not initiated", request);
            return;
        }

        //Launching hidden services and Topic Authority if needed
        let preDecrypted = request.body.preDecrypted;
        let token = pendingLogin.loginToken;
        let clientHSPrivateKey, taPrivateKey, taHSPrivateKey;
        if(pendingLogin.clientHSLaunchRequired){
            console.log("clientHSLaunchRequired!");
            let hsPrivateKey = decryptBlob(token.privateKey, preDecrypted.clientHSPrivateKey);
            let response = await self.connector.createHiddenService(hsPrivateKey, true);
            console.log("Service has started: " + response.messages.ServiceID);
        }

        if (pendingLogin.taLaunchRequired){
            //Launch topic authority
            console.log("About to launch topicauthority");
            let taPrivateKey = decryptBlob(preDecrypted.topicAuthority.taPrivateKey);
            let taHSPrivateKey = decryptBlob(preDecrypted.topicAuthority.taHSPrivateKey);
            await self.launchTopicAuthority(request.headers.pkfpSource, taPrivateKey, taHSPrivateKey);

        }

        await self.initSession(request, socket, self);
    }

    /**
     * Check whether it is required to launch Topic Authority
     * To determine that it checks whether topic authority with such id in
     * IslandsChat.sopicAuthorities and whether topic authority hidden service is running
     * @param metadata
     * @returns {Promise<boolean>}
     */
    async taLaunchRequired(metadata) {
        return !this.topicAuthorities.hasOwnProperty(metadata.body.topicAuthority.pkfp) ||
            !await this.connector.isHSUp(metadata.body.topicAuthority.residence);
    }


    async getTopicAuthorityData(pkfp, self){
        let taPrivateKey = await self.hm.getTopicKey(pkfp, "taPrivateKey")
        let topicHSPrivateKey = await self.hm.getTopicKey(pkfp, "topicHSPrivateKey")
        return {
            taPrivateKey: taPrivateKey,
            taHSPrivateKey: topicHSPrivateKey
        }
    }

    /**
     * Sends additional request to client to decrypt hidden service key
     * and/or Topic Authority private and HS private keys
     * @param request
     * @param socket
     * @param self
     * @param data
     */
    loginSendDataForDecryption(request, socket, self, data){
        //Create new key
        let ic = new iCrypto();
        ic.asym.createKeyPair("kp", 1024);
        self.pendingLogins[request.body.sessionID].loginToken = ic.get("kp");
        request.headers.response = "login_decrypt_data";
        request.body.loginToken = ic.get("kp").publicKey;
        request.body.loginData = data;
        socket.emit("response", request);
    }

    /**
     * Called after initLogin. checks HS and launches it if necessary
     * @param request
     * @param socket
     * @param self
     */
    async initSessionBak(request, socket, self){
        console.log("init session called");


        let returnError = (err)=>{
            console.log("initSession on login error: " + err);
            request.headers.error = err.message;
            request.headers.response = "login_fail";
            console.log("Login fail: " + err);
            socket.emit("response", request);
        };


        if(!self.pendingLogins[request.body.sessionID]){
            console.log("Attempt to launch session without login. sessionID: " + request.body.sessionID);
            return;
        }


    }

    async initSession(request, socket, self){
        //Write session variables
        console.log("init session called!");

        if(!self.isSessionActive(request.headers.pkfpSource)){
            console.log("No active session found. Initalizing new session");
            let session = {
                pkfp: request.headers.pkfpSource,
                publicKey: request.body.publicKey,
                sockets: [socket]
            };
            //writing session variable
            self.activeSessions[session.pkfp] = session;

        } else {
            console.log("Active session found. Just adding socket");
            self.activeSessions[request.headers.pkfpSource].sockets.push(socket);
        }

        let session = self.activeSessions[request.headers.pkfpSource]

        //writing socket to session mapping, so I can kill the session on disconnect
        self.socketSessionMapping[socket.id] = request.headers.pkfpSource;


        //Deleting pending login
        delete self.pendingLogins[request.body.sessionID];
        //console.log("my Island session: " + CircularJSON.stringify(this.activeSessions[session.pkfp]));
        console.log("Init login success, emitting...");
        // let pendingInvites = request.body.pendingInvites;
        //self.connector.checkAndStartBulkHS(pendingInvites);

        try{
            let data = await self.hm.getLastMessagesAndKeys(30, session.pkfp)
            let metadata = await self.hm.getLastMetadata(request.headers.pkfpSource)
            //data contains array of messages and map of keys like metaID: key
            let response = new Message();
            response.headers.response = "init_session_success";
            response.body.lastMessages = data;
            response.body.metadata = metadata;
            socket.emit("response", response);
        } catch (err){
            console.log("Error getting last messages: " + err);
        }
    }

    /**
     * Given public key fingerprint of a user
     * returns whether an active session is registered on the island
     * and whether there is at list one connected client socket
     * @param pkfp
     */
    isSessionActive(pkfp){
        let session = this.activeSessions[pkfp];
        //console.log("=============ACTIVE SESSIONS: " + CircularJSON.stringify(this.activeSessions));
        if(session){
            for (let i = 0; i<session.sockets.length; ++i){
                if (session.sockets[i].connected){
                    return true;
                }
            }
        }
        return false;
    }

    async loadMoreMessages(request, socket, self){
        try{
            let messages, metadataIDs;
            let allLoaded = false;

            //Getting public key og the owner
            let publicKey = await self.hm.getOwnerPublicKey(request.headers.pkfpSource)

            if (!Message.verifyMessage(publicKey, request)){
                throw new Error("Request was not verified");
            }

            let data = await self.hm.loadMoreMessages(request.headers.pkfpSource, request.body.lastLoadedMessageID);
            messages = data[0];
            metadataIDs = data[1];
            allLoaded = data[2];

            let gatheredKeys  = await self.hm.getSharedKeysSet(metadataIDs, request.headers.pkfpSource)

            let response = new Message();
            response.headers.response = "load_more_messages_success";
            response.body.lastMessages = {
                messages: messages,
                keys: gatheredKeys,
                allLoaded: allLoaded
            };
            socket.emit("response", response);
        }catch(err){
            let response = new Message();
            response.headers.response = "load_more_messages_fail";
            response.headers.error = err;
            socket.emit("response", response);
        }
    }

    /**
     * removes session from the list of active sessions
     * @param pkfp
     */
    closeSession(pkfp){
        delete this.activeSessions[pkfp];
    }

    initInvite(request, socket, self){
        let response = new Message(request);
        self.connector.createHiddenService()
            .then(result =>{
                response.headers.response = "init_invite_success";
                console.log("Success init invite: " + typeof(result.messages) + " " + result.messages );
                response.body.onionAddress = result.messages.ServiceID + ".onion";
                response.body.hsPrivateKey = result.messages.PrivateKey.substr(result.messages.PrivateKey.indexOf(":")+1);
                socket.emit("response", response);
            })
            .catch(err =>{
                console.log("Error init invite: " + err);
                response.headers.error = err;
                response.headers.response = "init_invite_fail";
                socket.emit("response", response);
            })
    }

    saveNewInvite(request, socket, self){
        let response = new Message(request);
        console.log("Saving new invite pkfp: " + request.body.pkfp);
        self.hm.saveNewInvite(request.body.inviteID, request.body.invite, request.body.pkfp)
            .then(()=>{
                return self.hm.getPendingInvites(request.body.pkfp);
            })
            .then(invites =>{
                console.log("Invite saved emitting success...");
                response.headers.response = "save_invite_success";
                response.body.invites = invites;
                socket.emit("response", response);
            })
            .catch(err =>{
                console.log("Failed to save invite: " + err);
                response.headers.response = "save_invite_fail";
                response.headers.error = err;
                socket.emit("response", response);
            })
    }

    inviteSetInviteeName(request, socket, self) {

        self.verifyClientRequest(request)
            .then((verified) =>{
                if (!verified){
                    throw new Error("Request was not verified");
                }

                return self.hm.saveNewInvite(request.body.inviteID, request.body.invite, request.headers.pkfpSource);
            })
            .then(() =>{
                return self.hm.getPendingInvites(request.headers.pkfpSource)
            })
            .then(invites =>{
                console.log("Invite update successfull");
                let response = new Message();
                response.headers.response = "update_invite_success";
                response.body.invites = invites;
                socket.emit("response", response);

            })
            .catch(err =>{
                console.log("Failed to save invite: " + err);
                response.headers.response = "update_invite_fail";
                response.headers.error = err;
                socket.emit("response", response);
            })
    }

    /**
     * Processes del invite request from the user
     * @param request
     * @param socket
     * @param self
     */
    delInvite(request, socket, self){
        self.hm.getOwnerPublicKey(request.headers.pkfpSource)
            .then((publicKey)=>{
                request = new Message(request);
                if (!Message.verifyMessage(publicKey, request)){
                    throw new Error("Request was not verified!");
                }
                return self.consumeInvite(request.headers.pkfpSource, request.body.inviteID, request.body.onion)
            })
            .then(()=>{
                return self.hm.getPendingInvites(request.headers.pkfpSource)
            })
            .then(pendingInvites =>{
                request.body.pendingInvites = pendingInvites;
                request.headers.response = "del_invite_success";
                socket.emit("response", request)
            })
            .catch(err=>{
                console.log("Error deleting invite: " + err);
                request.headers.response = "del_invite_fail";
                request.headers.error = err;
                socket.emit("response", request)
            })
    }

    /**
     * Takes down invite's hidden service and deletes invite's file
     * @param pkfp
     * @param inviteCode
     * @param hsid
     * @returns {Promise}
     */
    consumeInvite(pkfp = this.pRequired("consumeInvite"),
                  inviteCode =this.pRequired("consumeInvite"),
                  hsid = this.pRequired("consumeInvite")){
        return new Promise((resolve, reject)=>{
            this.connector.killHiddenService(hsid)
                .then(()=>{
                    return this.hm.consumeInvite(pkfp, inviteCode)
                })
                .then(()=>{
                    console.log("Invite " + inviteCode + " Successfully consumed");
                    resolve()
                })
                .catch(err =>{
                    reject(err)
                })
        })
    }


    /**
     * Request from client to boot certain member of the topic
     * Checks wether an issuer has rights to boot a member
     * Appends new metadata to history
     * sends new metadata blob to all members
     *
     * Also, sends  notification to booted member
     *
     * @param message
     * @param socket
     * @param self
     */
    bootParticipant(message, socket, self){
        console.log("Booting participant");

        let authorpkfp = message.headers.pkfpSource;
        let authorResidence = self.activeSessions[authorpkfp].residence;

        self.hm.getLastMetadata(authorpkfp)
            .then(metadata=>{
                metadata = JSON.parse(metadata);

                if (metadata.public.participants[authorpkfp].rights < 3){
                    throw new Error("Not enough rights");
                }
                //Verify message
                let authorPublicKey = self.activeSessions[authorpkfp].publicKey;
                if (!Message.verifyMessage(authorPublicKey, message)){
                    throw new Error("Message verification failed");
                }
                return self.hm.getOwnerPublicKey(authorpkfp)
            })
            .then(pubKey=>{
               if(!self.verifyMetadata(message.body.metadata, pubKey)){
                   throw new Error("Metadata is invalid");
               }
               return self.hm.appendMetadata(message.body.metadata, authorpkfp)

            })
            .then(()=>{
                //Send new metadata to everyone
                let promises = []
                let participants = JSON.parse(message.body.metadata).public.participants
                for (let i of Object.keys(participants)){
                    if (i !== authorpkfp ){
                        message.headers.pkfpDest = i;
                        promises.push(self.connector.send(
                            new Envelope(
                                message,
                                participants[i].residence,
                                "request",
                                authorResidence)
                        ))
                    }
                }

                let forBooted = new Envelope(
                    message.body.messageToBooted,
                    message.body.bootedResidence,
                    "note",
                    authorResidence);

                //Notify the one who has been booted
                promises.push(self.connector.send(forBooted));

                return Promise.all(promises);
            })
            .then(()=>{
                //Notify boot successfull to all my active sockets
                let mySession  = self.activeSessions[authorpkfp];
                let bootedPkfp = message.body.messageToBooted.headers.pkfpDest
                delete mySession.participants[bootedPkfp];
                let response = new Message(message);
                response.headers.response = "boot_participant_success";
                for (let s of mySession.sockets){
                    s.emit("response", response)
                }
            })
            .catch(err =>{
                console.log("Error booting member: " + err);
                message.headers.response = "boot_participant_failed";
                message.headers.error = err;
                socket.emit("response", message);
            })
    }

    /**
     * Request from another user to update metadata on user deletion
     * Check whether user has rights to boot a user. If not - ignore the request
     * Else - update metadata, push updated meta to each connected socket, if session is active
     * @param message
     * @param socket
     * @param self
     */
    participantBooted(message, socket, self){
        console.log("Participant booted called!!!");
        let authorPkfp = message.headers.pkfpSource;
        let pkfpDest = message.headers.pkfpDest;
        let author;
        self.hm.getLastMetadata(pkfpDest)
            .then(metadata=>{
                metadata = JSON.parse(metadata);
                author = metadata.public.participants[authorPkfp];
                //Verify
                if (author.rights < 3){
                    throw new Error("Attempt to boot someone without required rights");
                }
                else  if (!self.verifyMetadata(message.body.metadata, author.publicKey)){
                    throw new Error("Attempt to boot someone without required rights");
                }
                return self.hm.appendMetadata(message.body.metadata, pkfpDest)
            })
            .then(()=>{
                //notify all my active sockets
                if (self.activeSessions[pkfpDest]){
                    let bootedPkfp = message.body.messageToBooted.headers.pkfpDest
                    delete self.activeSessions[pkfpDest].participants[bootedPkfp];
                    for (let s of self.activeSessions[pkfpDest].sockets){
                        s.emit("note", message)
                    }
                }
            })
            .catch(err=>{
                console.log("Error in function participantBooted:  " + err);
            })
    }


    /**
     * TODO implement method
     * Called when boot notification is received
     * on the "bootee" side
     * Verify request
     * Check if the author has rights to boot someone
     * Conceal topic
     * Notify all sockets     *
     *
     * @param message
     * @param self
     */
    youWereBooted(message, socket, self){
        console.log("YOU WERE BOOTED called!");
        let authorPkfp = message.headers.pkfpSource;
        let pkfpDest = message.headers.pkfpDest;
        let author;
        self.hm.getLastMetadata(pkfpDest)
            .then(metadata=>{
                metadata = JSON.parse(metadata);
                author = metadata.public.participants[authorPkfp];
                //Verify
                if (author.rights < 3) {
                    throw new Error("Attempt to boot someone without required rights");
                }
                //Processing me booted
                metadata.public.status = "sealed";
                return self.hm.appendMetadata(JSON.stringify(metadata), pkfpDest);
            })
            .then(()=>{
                if (self.activeSessions[pkfpDest]){
                    let mySession = self.activeSessions[pkfpDest];
                    delete mySession.participants;
                    for (let s of mySession.sockets){
                        s.emit("note", message);
                    }
                }
            })
            .catch(err=>{
                console.log("Error in  youWereBooted:  " + err);
            })
    }




    getLastMetadata(){

    }

    shoutMessage(message, socket, self){
        console.log("Shouting the messaage");
        let pkfp = message.headers.pkfpSource;
        if(!self.isSessionActive(pkfp)){
            console.log("Attempt to send a message without logging in");
            self.sendMessageFail("Login required", message, socket)
            return;
        } else if(self.activeSessions[message.headers.pkfpSource].status === "sealed"){
            console.log("Attempt to send a message on sealed topic");
            self.sendMessageFail("This topic is sealed.", message, socket)
            return;
        }
        let recipients;
        self.hm.getLastMetadata(pkfp)
            .then(metadata =>{
                console.log("Shout message: Metadata obtained");
                metadata = JSON.parse(metadata);
                let myPublicKey = metadata.public.participants[pkfp].publicKey;

                message = new Message(message);

                let verified = Message.verifyMessage(myPublicKey, message);
                if(!verified){
                    let err = "Message signature is not valid!";
                    self.sendMessageFail(err, message, socket);
                    return;
                }

                //append message to history file
                recipients = metadata.public.participants;
                console.log("Message valid. Going to append...");
                return self.hm.appendMessage(message.body.message, pkfp);
            })
            .then(()=>{
                console.log("Message appended to history file. Now will attempt to send it to all recepients..");
                //Send to every participant except me
                let promises = [];
                let myResidence = recipients[pkfp].residence;
                let recipientsPkfps = Object.keys(recipients);

                //send to every participant on the conversation
                for (let i=0; i< recipientsPkfps.length; ++i){
                    if(recipientsPkfps[i] === pkfp) {
                      //  console.log("That's me, ain't sending to myself");
                        continue;
                    }
                    let onionDest = recipients[recipientsPkfps[i]].residence;
                    //console.log(JSON.stringify(recipients));
                    console.log("Gotta send to " + onionDest + "/" + recipientsPkfps[i] + " from: " + myResidence +"/"+ pkfp);

                    let nMessage = new Message(message);
                    nMessage.headers.pkfpDest = String(recipientsPkfps[i]);

                    promises.push(self.connector.send(new Envelope(nMessage, onionDest, "message", myResidence)))
                }
                return Promise.all(promises);
            })
            .then(()=>{
                console.log("Message sended to all recepients successfully");
                message.headers.response = "send_success";
                for (let s of self.activeSessions[message.headers.pkfpSource].sockets){
                    s.emit('response', message);
                }

            })
            .catch(err=>{
                self.sendMessageFail(err, message, socket);
            })
    }

    sendMessageFail(err, message, socket){
        message.headers.response = "send_fail";
        message.headers.error = err;
        socket.emit('response', message);
        console.log("Error sending message: " + err);
    }

    /**
     *
     * @param data {
     *  message: message
     *  socketID: socketID
     * }
     */
    processIncomingMessage(message, socketID){
        console.log("Got regular chat message. Processing... ");
        //Verify the message
        message = new Message(message.message);
        let authorPkfp = message.headers.pkfpSource;
        let myPkfp = message.headers.pkfpDest;

        this.hm.getLastMetadata(myPkfp)
            .then((metadata)=>{
                //Verify message
                try{
                    console.log("verifying the message");
                    metadata = JSON.parse(metadata).public;
                    console.log("Metadata: " + JSON.stringify(metadata) + "\nAuthor pkfp: " + authorPkfp);
                    if(!metadata.participants[authorPkfp]){
                        throw new Error("Incoming message: Author's pkfp is not registered in this topic");
                    }
                    let authorPublicKey = metadata.participants[authorPkfp].publicKey;

                    //Deleting pkfpDest to check the signature
                    //the message is signed on client before pkfpDest set on server
                    delete message.headers.pkfpDest;
                    console.log("HEADERS: " + JSON.stringify(message.headers));
                    if(!Message.verifyMessage(authorPublicKey, message)){
                        throw new Error("Message signature is not valid!");
                    }
                    //appens to history
                    return this.hm.appendMessage(message.body.message, myPkfp);
                }catch(err){
                    throw new Error("Error verifying the message: " + err);
                }
            })
            .then(()=>{
                let mySession = this.activeSessions[myPkfp];
                if (mySession){
                    console.log("My session is active! ");
                    for (let i = 0; i<mySession.sockets.length; ++i){
                        let socket = mySession.sockets[i];
                        if (socket.connected){
                            console.log("Emmiting message to my socket");
                            socket.emit("message", message);
                        }
                    }
                }
            })
            .catch((err)=>{
                console.log("Error processing incoming chat message: " + err);
            })
    }


    loadPendingTopicJoins(){
        let path =this.basePath + 'pendingTopicJoins';
        console.log("Path for saving pending topic joins: " + path);

        if (fs.existsSync(this.basePath + 'pendingTopicJoins')) {
            fs.readFile(this.basePath + 'pendingTopicJoins', (err, data)=>{
                if (err) throw err;
                try{
                    this.pendingTopicJoins = JSON.parse(data.toString());
                    console.log("Pending join topics loaded: " + JSON.stringify(this.pendingTopicJoins));
                } catch(err){
                    console.log('error reading pending topic joins: ' + err);
                    this.pendingTopicJoins = {};
                }

            })
        }else{
            this.pendingTopicJoins = {};
            console.log("Pending join topics loaded: " + JSON.stringify(this.pendingTopicJoins));
        }

    }

    savePendingTopicJoins(){
        let path =this.basePath + 'pendingTopicJoins';
        console.log("Path for saving pending topic joins: " + path);
        let data = JSON.stringify(this.pendingTopicJoins);
        fs.writeFile(path, data, (err)=>{
            if (err){
                console.log("Error saving pendingTopicJoins");
                throw err;
            }
            console.log("Pending topic joins updated successfully!");
        })
    }

    loadActiveSessions(){
        if (fs.existsSync(this.basePath + 'activeSessions')) {
            fs.readFile(this.basePath + "activeSessions", (err, data) => {
                if (err) throw err;
                try {
                    this.activeSessions = JSON.parse(data.toString());
                    console.log("Active sessions loaded: " + JSON.stringify(this.activeSessions));
                } catch (err) {
                    console.log('error reading active sessions: ' + err)
                    this.activeSessions = {}
                }
            })
        }else{
            this.activeSessions = {};
            console.log("Active sessions loaded: " + JSON.stringify(this.activeSessions));
        }
    }

    getActiveSocket(pkfp = this.pRequired("IsSessionActive")){
        let session = this.activeSessions[pkfp];
        if (session){
            for (let i=0; i<session.sockets.length; ++i){
                if (session.sockets[i].connected)
                    return session.sockets[i];
            }
        }
        return null;
    }


    /**
     * Verifies request from local client
     *
     * Assumes that request has property request.headers.pkfpSource
     * returns promise
     * resolves boolean verified or not verified
     * On any error rejects with error message
     *
     * @param {Message} request
     * @returns {Promise}
     */

    verifyClientRequest(request){
        return new Promise((resolve, reject)=>{
            if (!request instanceof Message){
                request = new Message(request);
            }
            this.hm.getOwnerPublicKey(request.headers.pkfpSource)
                .then(publicKey =>{
                    resolve(Message.verifyMessage(publicKey, request))
                })
                .catch(err =>{
                    reject(err);
                })
        })
    }

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


    /**
     * Verifies metadata sender
     * Used to check metadata before appending it to history
     * Accepts stringified blob as well as object
     * @param metadata
     * @param publicKey
     * @returns {*}
     */
    verifyMetadata(metadata, publicKey){
        if (typeof(metadata) === "string"){
            metadata = JSON.parse(metadata);
        }

        let ic = new iCrypto();

        ic.setRSAKey("pubk", publicKey, "public")
            .addBlob("sign", metadata.signature)
            .addBlob("public", JSON.stringify(metadata.public))
            .addBlob("prenc", metadata.privateEncrypted)
            .merge(["public", "prenc"], "gblob")
            .publicKeyVerify("gblob", "sign", "pubk", "res");
        return ic.get("res");
    }


    pRequired(functionName = "IslandChat function"){
        throw functionName + ": missing required parameter!"
    }

}


class Envelope{
    constructor(message, destination, type, origin){
        if (!['request', "response", "message", "note"].includes(type)){
            throw new Error("Envelope: invalid type");
        }
        this.message = message;
        this.destination = destination;
        this.type = type;
        origin ? this.origin = origin : false;
    }

}

/**
 *
 *
 * Possible headers:
 *  command: used mainly between browser and island
 *  response: island response to browser. This is an arbitrary string by which
    *         sender identifies the outcome of the request. Can be an error code like login_error
 *  error: error message if something goes wrong it should be set. If it is set -
 *              the response treated as an error code
 *  pkfpSource: public key fingerprint of the sender
 *  pkfpDest: public key fingerprint of the recipient
 *
 *
 */
class Message{
    constructor(request){
        if(typeof(request)==="string"){
            request = JSON.parse(request);
        }
        this.headers = (request ? (this.copyHeaders(request.headers)) : ({
            command: "",
            response: ""
        }));
        this.body = request ? request.body : {};
        this.signature = request ? request.signature : "";
    }

    /**
     * Verifies client request
     * Resolves with boolean verified-true/not verified-false
     * @param publicKey
     * @param message
     * @returns {*}
     */
    static verifyMessage(publicKey, message){
        let valid = false;
        try{
            if (typeof (message) === "string"){
                message = JSON.parse(message);
            }
            let ic = new iCrypto();
            let requestString = JSON.stringify(message.headers) + JSON.stringify(message.body);

            ic.setRSAKey("pubk", publicKey, "public")
                .addBlob("sign", message.signature)
                .hexToBytes('sign', "signraw")
                .addBlob("b", requestString);
            ic.publicKeyVerify("b", "sign", "pubk", "v");
            valid = ic.get("v");
        } catch(err){
            console.log("Error verifying message: " + err);
        }
        return valid;
    }

    setError(error){
        this.headers.error = error || "Unknown error";
    }

    setResponse(response){
        this.headers.response = response;
    }

    copyHeaders(headers){
        let result = {};
        let keys = Object.keys(headers);
        for (let i=0; i< keys.length; ++i){
            result[keys[i]] = headers[keys[i]];
        }
        return result;
    }

    signMessage(privateKey){
        let ic = new iCrypto();
        let requestString = JSON.stringify(this.headers) + JSON.stringify(this.body);
        ic.addBlob("body", requestString)
            .setRSAKey("priv", privateKey, "private")
            .privateKeySign("body", "priv", "sign");
        this.signature = ic.get("sign");
    }




    get  (name){
        if (this.keyExists(name))
            return this[name];
        throw new Error("Property not found");
    };

    set (name, value){
        if (!Message.properties.includes(name)){
            throw 'Invite: invalid property "' + name + '"';
        }
        this[name] = value;
    };

}

Message.properties = ["headers", "body", "signature"];



module.exports = IslandsChat;



