const ioClient = require('socket.io-client');
const io = require('socket.io');
const EventEmitter = require('events').EventEmitter;
const Err = require("./IError.js");
const iCrypto = require('./iCrypto');
const Logger = require("../libs/Logger.js");

const TorController = require('./TorController.js');

const Bimap = require('../libs/Bipartite.js');

let SocksProxyAgent = require('socks5-http-client/lib/Agent');

const http = require("http");


//Address and port for tor facing server
//This should be set to address and port of a hidden service

let hiddenServiceHOST = '127.0.0.1';
let hiddenServicePORT = 4003;
let torListenerPort = 80;
let torControlHost = '127.0.0.1';
let torControlPort = 9051;
let torControlPassword = "";
let socksProxyHost = "127.0.0.1";
let torSOCKSPort = "9050";

class TorConnector extends EventEmitter{

    /**
     *
     * @param opts
     * opts can contain following options:
     *     hiddenServiceHOST
     *     hiddenServicePORT
     */
    constructor(opts){
        super();


        let torOpts = opts.torConnector ? opts.torConnector : {};
        //Set all the variables
        console.log("Initializing tor connector at " + JSON.stringify(opts.torConnector));
        this.httpHOST = torOpts.hiddenServiceHOST || hiddenServiceHOST;
        this.httpPORT = torOpts.hiddenServicePORT || hiddenServicePORT;
        this.torListenerPort = torOpts.torListenerPort || torListenerPort;
        this.torControlPort = torOpts.torControlPort || 9051;
        this.torControlHost = torOpts.torControlHost || torControlHost;
        this.torControlPassword = torOpts.torControlPassword || torControlPassword;
        this.torSOCKSPort = torOpts.torSOCKSPort || torSOCKSPort;
        this.reconnnectAttempts = 7;
        this.reconnectDelay = 15000;


        //maps socketID <=> onion address
        //For all active connections
        this.connectionsIncoming = new Bimap();
        this.connectionsOutgoing = new Bimap();


        this.fileConnections = {};

        //Pending interisland connections. If connection is pending - it should be
        //oncluded here in form of <onionaddres>.onion -> 1
        this.pendingConnections = {};
        this.filePendingConnections = {};

        this.torController = new TorController({
            host: this.torControlHost,
            port: this.torControlPort,
            password: this.torControlPassword
        });

        //server socket which listening and accepting incoming connections from TOR
        this.torSocket = null;

        //Map socketID => sockets for all the sockets connected
        //regardless of whom call whom
        this.torSocketsOutgoing = {};
        this.torSocketsIncoming = {};
        this.initServer();
        this.initCleanupWorker()

        //init listening server for accepting incoming connections
    }


    //init listening server for accepting incoming connections
    initServer(){

        const httpServer = http.createServer((req, res)=>{
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.write("404 - ERROR\nOOOPS... You found nothing here.... Keep looking!\n");
            res.end();
        });

        httpServer.listen(this.httpPORT, this.httpHOST, ()=>{
            console.log('HTTP server listening on ' + this.getConnectionString());
        });

        this.io = io.listen(httpServer);
        this.torSocket = this.io.of('/chat');
        this.fileTorSocket = this.io.of('/file');
        this.torSocket.on('connection', (socket)=>{
            this.acceptCall(socket);
        });

        this.fileTorSocket.on('connection', (socket)=>{
            this.acceptFileTransferCall(socket);
            socket.emit("ready");
        })
    }

    acceptFileTransferCall(socket){
        console.log("got a new file transfer call. socket.id: " + socket.id);
        socket.on("get_file", (data)=>{
            console.log("Received get_file request");
            this.emit("get_file", socket, data)
        });
        console.log("listeners set");

    }

    callPeerFileTransfer(onionDest){
        let self = this;
        return new Promise((resolve, reject)=>{
            try{
                console.log("CALLING HIDDEN PEER: " + onionDest  + " TO GET THE FILE");
                if(this.fileSocketConnected(onionDest) || this.fileConnectionPending(onionDest)){
                    console.log("Already connected to file socket! Resolving");
                    resolve(this.fileConnections[onionDest].id);
                    return;
                }

                this.setPendingConnection(onionDest);
                const agent = new SocksProxyAgent({
                    socksHost: self.httpHOST,
                    socksPort: self.torSOCKSPort
                });
                const endpoint = this.getWSOnionConnectionString(onionDest);
                let socket = ioClient(endpoint + '/file', {
                    agent: agent,
                    'force new connection': true,
                    reconnection: true,
                    reconnectionDelay: this.reconnectDelay,
                    reconnectionDelayMax : 10000,
                    reconnectionAttempts: this.reconnnectAttempts
                });

                socket.on("ready", ()=>{
                    this.fileConnections[onionDest] = socket.id;
                    this.fileUnsetPendingConnection(onionDest);
                    console.log("Hidden socket ready to receive file transfer request");
                    resolve(socket)
                });

                socket.on('connect', ()=>{
                    console.log("Connected to hidden peer's file transfer channel ");
                });

                socket.on('disconnect', ()=>{
                   delete this.fileConnections[onionDest];
                });

                socket.on('connect_error', (err)=>{
                    console.log("TOR connector: File socket connection error: " + err);
                });

                socket.on('connect_timeout', (timeout) => {
                    console.log("TOR connector: File socket connection timeout: " + timeout);
                });

                socket.on('reconnect_attempt', (attemptNumber)=>{
                    console.log("attempting to reconnect " + attemptNumber + " of " + this.reconnnectAttempts);
                    if (attemptNumber === this.reconnnectAttempts){
                        this.unsetPendingConnection(onionDest);
                    }
                });


            }catch(err){

            }
        })
    }


    getFileSocket(id){
        return this.fileTorSocket.sockets[id];
    }

    //Connect to peer that listening on a hidden service (onion) 
    //and save the connection int he list of current connections
    //

    async callPeer(onionDest, onionOrig, maxAttempts = 7, timeout = 20000){
        Logger.silly("Very top of callPeer function");
        let self = this;
        if (self.connectionPending(onionDest)){
            Logger.debug("Connection is pending",  {
                origin: onionOrig,
                destination: onionDest,
            });
            return
        }

        if(self.isConnected(onionDest)){
            Logger.debug("Alerady connected to hidden peer", {
                origin: onionOrig,
                destination: onionDest,
            });
            self.emit("connection_established", onionDest);
            return
        }

        self.setPendingConnection(onionDest);
        Logger.debug("Calling hidden peer", {
            origin: onionOrig,
            destination: onionDest,
            cat: "connection"
        });

        const agent = new SocksProxyAgent({
            socksHost: self.httpHOST,
            socksPort: self.torSOCKSPort
        });

        const endpoint = self.getWSOnionConnectionString(onionDest);

        let attempt = 1;

        const socket = ioClient(endpoint + '/chat', {
            autoConnect: false,
            agent: agent,
            forceNew: true,
            reconnection: false,
            connection: 'Upgrade',
            upgrade: 'websocket',
            query: onionOrig ? 'call_from=' + onionOrig : undefined
        });

        let attemptConnection = ()=>{
            Logger.debug("Attempting to call hidden peer", {
                origin: onionOrig,
                destination: onionDest,
                attempt: attempt,
                socksHost: self.httpHOST,
                socksPort: self.httpPORT,
                cat: "connection"
            });
            socket.open();
        };

        let handleUnsuccessfullConnectAttempt = (errorMsg)=>{
            if(attempt < maxAttempts){
                attempt +=1;
                setTimeout(()=>{
                    attemptConnection()
                }, timeout)
            }else{
                Logger.warn("Failed to connect to hidden peer" ,{
                    origin: onionOrig,
                    destination: onionDest,
                    attempts: maxAttempts
                });
                self.unsetPendingConnection(onionDest);
                self.emit("connection_error", {
                    origin: onionOrig,
                    destination: onionDest,
                    maxAttempts: maxAttempts,
                    attempts: attempt,
                    error: errorMsg
                })
            }
        };

        socket.on('connect', async () => {
            self.connectionsOutgoing.push(onionDest, socket.id);
            self.torSocketsOutgoing[socket.id] = socket;
            self.unsetPendingConnection(onionDest);
            self.setSocketListeners(socket);
            Logger.debug("Connected to hidden peer", {
                origin: onionOrig,
                destination: onionDest,
                attempt: attempt
            });

            self.emit("connection_established", onionDest);
        });

        socket.on('connect_error', (err)=>{
            handleUnsuccessfullConnectAttempt(err.message);
        });

        socket.on('connect_timeout', (timeout) => {
            handleUnsuccessfullConnectAttempt("Connection timeout");
        });

        socket.on("disconnect", ()=>{
            self.processDisconnect(socket)
        });

        attemptConnection();
    }


    /**** PENDING CONNECTIONS ****/
    connectionPending(onion){
        return (this.pendingConnections[onion] &&  this.pendingConnections[onion].pending);
    }

    setPendingConnection(onion){
        Logger.debug("Setting connection to pending",  {
            destination: onion,
        });
        this.pendingConnections[onion] = {
            pending: true,
            timeSet: new Date()
        };
    }

    unsetPendingConnection(onion){
        Logger.debug("Unsetting pending connection",  {
            destination: onion,
        });
        delete this.pendingConnections[onion];
    }

    fileConnectionPending(onion){
        return this.filePendingConnections[onion] === 1;
    }

    fileSetPendingConnection(onion){
        this.filePendingConnections[onion] = 1;
    }

    fileUnsetPendingConnection(onion){
        delete this.filePendingConnections[onion];
    }


    fileSocketConnected(onion){
        return (this.fileConnections[onion] &&  this.fileConnections[onion].connected);
    }

    /**** END PENDING CONNECTIONS ****/

    acceptCall(socket){
        let callerHS = socket.handshake.query['call_from'];
        Logger.debug("Got new connection from TOR.", {CallerHS:  callerHS, socketID: socket.id});
        this.torSocketsIncoming[socket.id] = socket;
        this.setSocketListeners(socket);
        if(!callerHS){
            Logger.debug("Got unidentified connection with ", {socketId: socket.id});
            this.emit("unidentified_connection_established", socket.id)
        } else{
            Logger.debug("Got cross-island connection", {from: callerHS});
            this.connectionsIncoming.push(callerHS, socket.id);
            this.emit("connection_established", callerHS);
        }
    }


    /**************************************************
     * ============= Message handling   ==============*
     **************************************************/
    /**
     * Assumes that connection is established and active
     * but checks
     * @param message
     * @param destination
     * @param type ENUM request, response, message
     */
    async sendDirectly(envelope = Err.required()){
        let socket = this.getActiveSocket(envelope.destination);
        if(!socket){
            throw new Error("sendDirectly: active socket was not found. Destination: " + envelope.destination);
        }
        Logger.debug("Sending message to hidden peer", {
            destination: envelope.destination
        });
        socket.send(envelope);
    }

    getActiveSocket(destination){
        if (this.isOnionAddressValid(destination)){
            return  this._checkIncomingConnections(destination) ? this._getIncomingActiveSocket(destination) :
                this._getOutgoingActiveSocket(destination);
        } else{
            return this.torSocketsIncoming[destination]  ?  this.torSocketsIncoming[destination] :
                this.torSocketsOutgoing[destination];
        }
    }

    _getIncomingActiveSocket(destination = Err.required()){
        if(this.connectionsIncoming.hasKey(destination)){
            let sockets = this.connectionsIncoming.key(destination);
            if(sockets){
                for(let id of sockets){
                    if (this.torSocketsIncoming[id] && this.torSocketsIncoming[id].connected){
                        return this.torSocketsIncoming[id]
                    }
                }
            }
        }
    }

    _getOutgoingActiveSocket(destination = Err.required()){
        if(this.connectionsOutgoing.hasKey(destination)){
            let sockets = this.connectionsOutgoing.key(destination);
            if(sockets){
                for(let id of sockets){
                    if (this.torSocketsOutgoing[id] && this.torSocketsOutgoing[id].connected){
                        return this.torSocketsOutgoing[id]
                    }
                }
            }

        }
    }


    setSocketListeners(socket){
        socket.on('disconnect', ()=>{
            console.log("Socket " + socket.id + " hanged up.");
            this.processDisconnect(socket);
        });

        socket.on('message', envelope =>{
            if(envelope.origin && !this.connectionsIncoming.hasKey(envelope.origin) && !envelope.return){
                this.connectionsIncoming.push(envelope.origin, socket.id)
            }
            this.emit('message', envelope)
        });

    }

    processDisconnect(socket){
        let id = socket.id;
        if(id){
            Logger.verbose("TOR connector: connection closed, processing disconnect",{
                incomingLink: this.connectionsIncoming.val(id),
                outgoingLink: this.connectionsOutgoing.val(id)
            });
            delete this.torSocketsIncoming[id];
            delete this.torSocketsOutgoing[id];
            this.connectionsIncoming.delVal(id);
            this.connectionsOutgoing.delVal(id);
        } else{
            Logger.verbose("TOR connector: connection closed, processing disconnect");
        }
    }



    /**************************************************
     * ========== Connection management   ============*
     **************************************************/

    getSocketById(socketID){
        return this.torSocket.sockets[socket[ID]] || this.torSockets[socketID];
    }

    isConnected(destination){
        console.log("Checking if destination reachable");
        console.log("Destination: " + destination);
        return this._checkIncomingConnections(destination) || this._checkOutgoingConnections(destination)
    }

    _checkIncomingConnections(destination){
        console.log("Incoming connections: ");
        //this.connectionsIncoming.print(); //DEBUG ONLY
        if(this.connectionsIncoming.hasKey(destination)){
            let connectedSockets = this.connectionsIncoming.key(destination);
            if (connectedSockets){
                for (let id of connectedSockets){
                    if (this.torSocketsIncoming[id] && this.torSocketsIncoming[id].connected) {
                        return true
                    }
                }
            }
        }
    }

    _checkOutgoingConnections(destination){
        console.log("Outgoing connections: ");
        //this.connectionsOutgoing.print();// DEBUG only
        if(this.connectionsOutgoing.hasKey(destination)){
            let connectedSockets = this.connectionsOutgoing.key(destination);
            if (connectedSockets){
                for (let id of connectedSockets){
                    if (this.torSocketsOutgoing[id] && this.torSocketsOutgoing[id].connected) {
                        return true
                    }
                }
            }
        }
    }

    async isHSUp(hiddenServiceID){
        return await this.torController.isHSUp(hiddenServiceID);
    }
    async checkLaunchIfNotUp(privateKey, discardKey){
        const hsid = iCrypto.onionAddressFromPrivateKey(privateKey);
        if(!await this.isHSUp(hsid)){
            return await this.createHiddenService(privateKey, discardKey)
        }
    }

    /**
     * Returns array with SerivceID and Private key in PEM format
     * @param privateKey
     * @param discardKey
     * @returns {Promise}
     */
    async createHiddenService(privateKey, discardKey, awaitPublication = false){

        let params = {
            port: this.getHSPort(),
            keyType: privateKey ? "RSA1024" : "NEW",
            detached: true,
            discardKey: discardKey,
            awaitPublication: awaitPublication
        };
        if (privateKey){
            let ic = new iCrypto();
            ic.setRSAKey("priv", privateKey, "private")
                .pemToBase64("priv", "b64priv", "private");
            params.keyContent = ic.get("b64priv");
        }

        let torResponse = await this.torController.createHiddenService(params)
        const result = {};
        result.serviceID = torResponse.messages.ServiceID;
        if (torResponse.messages.PrivateKey){
            result.privateKey = this.parseHSPrivateKeyResponse(torResponse.messages.PrivateKey);
        }

        return result;

    }

    async killHiddenService(hsid){
        try{
            await this.torController.killHiddenService(hsid)
        }catch(err){
            console.log("Error killing hidden service: " + err);
            throw new Error(err);
        }
    }


    /**************************************************
     * =================== END  ===================== *
     **************************************************/


    /**************************************************
     * ================= UTIL  =======================*
     **************************************************/
    initCleanupWorker(){
        setInterval(async ()=>{
            await this.checkPendingConnections();
        }, 30000)
    }
    async checkPendingConnections(){
        let now = new Date();
        Object.keys(this.pendingConnections).forEach((key)=>{
            if(this.pendingConnections[key] && now - this.pendingConnections[key].timeSet > 120000){
                Logger.warn("Found zombie pending connection! Cleaning up...", {
                    timeSince: now - this.pendingConnections[key].timeSet >= 120000
                });
                this.unsetPendingConnection(key);
            }
        })
    }

    parseHSPrivateKeyResponse(privk = Err.required()){
        return iCrypto.base64ToPEM(privk.substr(8));
    }

    getWSOnionConnectionString(onion, wss = false){
        let onionPattern = /[a-z0-9]*\.onion/;
        let portPattern = /\:[0-9]{1,5}$/;
        if (!onion || !onion.match(onionPattern))
            throw new Error("getWSOnionConnectionString: Invalid onion address");
        onion = onion.trim();

        return (wss ? "wss://" : "ws://") + onion.match(onionPattern)[0] + 
            (onion.match(portPattern) ? onion.match(portPattern)[0] : "");

    }

    isOnionAddressValid(candidate){
        let pattern = /^[a-z2-7]{16}\.onion$/;
        return pattern.test(candidate);
    }

    getHSPort(){
        return this.torListenerPort + "," + this.httpHOST + ":" + this.httpPORT
    }


    getConnectionString(){
        return "http://" + this.httpHOST + ":" + this.httpPORT
    }

    /**************************************************
     * =================== END  ===================== *
     **************************************************/
}


module.exports = TorConnector;


