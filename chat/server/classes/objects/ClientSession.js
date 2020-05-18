const iCrypto = require("../libs/iCrypto.js");
const { Internal, Events } = require("../../../common/Events");
const Err = require("../libs/IError.js");
const CuteSet = require("cute-set");
const EventEmitter = require("events");
const Message = require("./Message.js");
const Logger = require("../libs/Logger.js");
const Utility = require("../libs/ChatUtility.js");

const SESSION_ID_LENGTH = 7;
/**
 * Session is an object that represents act of communication between client and server.
 * Client is identified by vault ID.
 *
 * Session object holds temporary session key that is used to sign and ecnrypt data between client and server.
 * The key is generated every time when session is created, or when key time expires.
 *
 * Session object keeps track of all active sockets that related to the vault, as well as all topic pkfps.
 * When last socket is disconnected - session still remains active until client reconnects or time is up.
 * Default timeout is set to 4 minutes. After that session object is destroyed.
 * 
 */
class ClientSession extends EventEmitter{

    constructor(vaultId = Err.required("Missing required parameter vaultId"),
                connectionId = Err.required("Missing required parameter socketId"),
                connectionManager = Err.required("Missing connection manager")) {
        super();
        this.pending = true;
        this.connectionManager = connectionManager;
        this.timeInitialized = Date.now();
        this.timeInactive = null;
        this.id = vaultId;
        this.connections = new CuteSet([connectionId]);
        this.topics = new CuteSet();
        this.publicKey;
        this.privateKey;
        this.pkfp;
        this.initKey();
        this.sendSessionKey(connectionId);
    }

    initKey(){
        let self = this;
        setTimeout(()=>{
            Logger.debug("Initializing keys", {cat: "session"});
            let ic = new iCrypto();
            ic.rsa.createKeyPair("kp")
            .getPublicKeyFingerprint("kp", "pkfp")
            self.pkfp = ic.get("pkfp");
            self.publicKey = ic.get("kp").publicKey;
            self.privateKey = ic.get("kp").privateKey;
            self.pending = false;
            Logger.debug("Session key has been generated!", {cat: "session"})
        }, 300)
    }

    async getPublicKey(){
        await this.waitForKey();
        return this.publicKey;
    }

    async getPrivateKey(){
        await this.waitForKey();
        return this.privateKey;
    }

    async decryptMessage(msg){
        let key = await this.getPrivateKey()
        return Utility.decryptStandardMessage(msg, key);
    }

    //msg must be an instance of Message
    //
    async signMessage(msg){
        let key = await this.getPrivateKey()
        msg.signMessage(key);
        return msg;
    }

    waitForKey(){
        let self = this;
        return new Promise((resolve, reject)=>{
            let timeout = 10000;
            let start = new Date();

            let tick = ()=>{
                if (self.pending){
                    if (new Date() - start > timeout){
                        reject(new Error(`Timeout getting session public key. Session is still pending. Key vaule: ${self.publicKey}`))
                        return;
                    }
                    setTimeout(tick, 500);
                } else {
                    resolve()
                }
            }
            tick();
        })
    }


    hasConnection(connectionId){
        return this.connections.has(connectionId);
    }

    hasTopic(pkfp){
        return this.topics.has(pkfp);
    }

    addTopic(pkfp){
        this.topics.add(pkfp);
        this.emit(Internal.TOPIC_ADDED, pkfp)
    }

    deleteTopic(pkfp){
        this.topics.remove(pkfp);
        this.emit(Internal.TOPIC_DELETED, pkfp)
    }

    addConnection(connectionId){
        Logger.debug(`Adding connection ${connectionId} to session ${this.id}`, {cat: "session"})
        this.connections.add(connectionId);

        Logger.debug(`Active connections: ${JSON.stringify(this.connections.toArray())}`)
        this.timeInactive = null;
        this.sendSessionKey(connectionId);
    }

    sendSessionKey(connectionId){
        let self = this;
        setTimeout(async ()=>{
            let publicKey = await self.getPublicKey()
            let privateKey = await self.getPrivateKey()
            let message = new Message()
            message.setDest(this.id);
            message.setSource("island");
            message.setCommand(Internal.SESSION_KEY);
            message.body.sessionKey = publicKey;
            message.addNonce();
            message.signMessage(privateKey);
            Logger.debug(`Sending session key to client`, {cat: "login"})
            this.connectionManager.sendMessage(connectionId, message)
        }, 100)

    }

    removeConnection(connectionId){
        Logger.debug(`Removing connection ${connectionId} from session ${this.id}`, {cat: "session"})
        this.connections.remove(connectionId);
        if(!this.isActive()){
            Logger.debug("Session is now inactive. Setting self-desdtruction timer", {cat: "session"})
            this.timeInactive = new Date();
            this.startSelfDestructionTimer();
        }
    }

    //pushes msg to all active sockets as message
    broadcast(msg){
        Logger.debug(`Broadcasting to all connections. Topics: ${JSON.stringify(this.topics.toArray())}. Connections: ${JSON.stringify(this.connections.toArray())}`, { cat: "session" })
        for (let connId of this.connections){
            console.log(`Sending message to ${connId}`)
            this.connectionManager.sendMessage(connId, msg)
        }
    }

    // Sends msg to all connections.
    // Connectoins are connectionId strings
    // if exclusive set to true, then message will be sent to
    // all active connections but those that are passed in connections argument
    multicast(msg, connections, exclusive=false){

        Logger.debug(`Multicasting. Topics: ${this.topics}`, { cat: "session" })
        let connIds = exclusive ?
            this.connections.minus(connections) :
            connections;
        for (connId of connIds){
            this.connectionManager.sendMesssage(connId, msg)
        }
    }

    // Sends given message to connection identified by connId
    send(msg, connId){
        Logger.debug(`Unicasting. Topics: ${this.topics}`, { cat: "session" })
        let connectionId = connId;
        if (!connId){
            if (this.connections.length === 0){
                return;
            } else {
                connectionId = this.connections.toArray()[0];
            }
        }
        Logger.debug(`Session: sending message, to ${connectionId}`, { cat: "session" })
        this.connectionManager.sendMessage(connectionId, msg);
    }

    isActive(){
        this.cleanZombies()
        return this.connections.length > 0;
    }

    activeConnectionsCount(){
        return this.connections.length;
    }

    startSelfDestructionTimer(){

        Logger.debug("Self destruction timer started", {cat: "session"})
        let self = this;
        let timeout = 240000; //timeout for 4 minutes
        let tick = ()=>{
            if (self.timeInactive === null){
                Logger.debug("Session is active again. Stopping timer...", {cat: "session"})
                return;
            }
            if (new Date() - self.timeInactive >= timeout){
                Logger.debug("Timeout reached. Destructing...", {cat: "session"})
                self.emit(Internal.KILL_SESSION, this);
            } else {
                setTimeout(tick, 2000);
            }
        }
        setImmediate(tick);
    }

    // ---------------------------------------------------------------------------------------------------------------------------
    // Goes over active connections and checks whether they alive. If not - removes them.
    cleanZombies(){
        let zombies = new CuteSet();
        for(let conn of this.connections){
            if (!this.connectionManager.isAlive(conn)){
                zombies.add(conn);
            }
        }
        if (zombies.length > 0){
            Logger.debug(`Found zombie connecions: ${JSON.stringify(zombies.toArray())}`, {cat: "connection"});
            this.connections = this.connections.minus(zombies);
        }
    }


}

module.exports = ClientSession;
