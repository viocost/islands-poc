const ClientSession = require("../objects/ClientSession.js");
const Err = require("./IError.js");
const Logger = require("../libs/Logger.js");
const { Internal, Events } = require("../../../common/Events")



class ClientSessionManager{
    constructor(connectionManager = Err.required()){

        // Sessions are stored by vaultID
        this.sessions = {};
        this.connectionManager = connectionManager;
        this.topicToSessionMap = {};
        this.registerConnectionManager(connectionManager);
    }

    registerConnectionManager(connectionManager){
        let self = this;
        connectionManager.on("client_connected", connectionId=>{

            let socket = connectionManager.getSocketById(connectionId);
            let vaultId = socket.handshake.query.vaultId;
            if(!vaultId){
                Logger.warn("Warning: no vaultID provided at the connection.", {cat: "connection"})
                return;
            }
            if(this.sessions.hasOwnProperty(vaultId)){
                console.log(`Session exists. Adding connection...`);
                self.sessions[vaultId].addConnection(connectionId);
            } else {
                console.log(`Session does not exist. Creating...`);
                let newSession = new ClientSession(vaultId, connectionId, connectionManager);
                this.sessions[vaultId] = newSession;

                newSession.on(Internal.KILL_SESSION, (session)=>{
                    Logger.debug(`Killing session ${session.id} on timeout`)
                    for(let pkfp of Object.keys(session.topics)){
                        delete self.topicToSessionMap[pkfp];
                    }
                    delete this.sessions[session.id]
                })

                newSession.on(Internal.TOPIC_ADDED, (pkfp)=>{
                    Logger.debug(`Topic ${pkfp} added for session ${newSession.id}`, {
                        cat: "session"
                    })
                    self.topicToSessionMap[pkfp] = newSession;
                })

                newSession.on(Internal.TOPIC_DELETED, (pkfp)=>{
                    Logger.debug(`Topic ${pkfp} deleted for session ${newSession.id}`, {
                        cat: "session"
                    })
                    delete self.topicToSessionMap[pkfp];
                })
            }
        })

        connectionManager.on("client_disconnected", connectionId=>{
            let session = self.getSessionByConnectionId(connectionId)
            if(session === undefined) return;
            session.removeConnection(connectionId);

        });

    }

    //Given participant's pkfp returns active session if exists
    getSession(pkfp){
        return this.topicToSessionMap[pkfp];
    }

    getSessionByConnectionId(connectionId = Err.required()){
        for(let session of Object.keys(this.sessions)){
            if (this.sessions[session].hasConnection(connectionId)){
                return this.sessions[session];
            }
        }
    }

    getSessionBySessionID(sessionID){
        return this.sessions[sessionID];
    }

    getSessionByTopicPkfp(pkfp){
        if (this.topicToSessionMap.hasOwnProperty(pkfp)){
            return this.topicToSessionMap[pkfp]
        } else {
            console.log(`No active sessions found for ${pkfp}` );
        }
    }


    createSession(pkfp, connectionId, sessionID){
        const sessions = this.getSessionBySessionID(sessionID);
        if (sessions.length > 0){
            this.cleanupZombieSessions(sessions);
        }

        this.registerSession(new ClientSession(pkfp, connectionId, sessionID));
        console.log("\nCreated new session. ConnectionId: " + connectionId);
        console.log("Sessions: " );
        Object.keys(this.connectionManager.socketHub.sockets).forEach(socketId=>{
            console.log("Key: "+ socketId + " Val: " + this.connectionManager.socketHub.sockets[socketId].id);
        })
        console.log("\n")
    }


    cleanupZombieSessions(sessions = Err.required()){
        sessions.forEach((session)=>{
            delete this.sessions[session.getConnectionID()];
        })
    }

    registerSession(session){
        if (!(session instanceof ClientSession)){
            throw new Error("Invalid session type");
        }
        this.sessions[session.getConnectionID()] = session;
    }



    broadcastUserResponse(pkfp, response){
        const activeConnections = this.getSession(pkfp);
        activeConnections.forEach((session)=>{
            this.connectionManager.sendResponse(session.getConnectionID(), response)
        })
    }

    broadcastServiceMessage(pkfp, message){
        const session = this.getSession(pkfp);
        if (session && session.activeConnectionsCount() > 0){
            session.broadcast(message)
        } else {
            Logger.debug(`No active connections found for ${pkfp}`, { cat: "session" });
        }
    }

    sendServiceMessage(connectionId, message){
        this.connectionManager.sendServiceMessage(connectionId, message)
    }

    broadcastServiceRecord(pkfp, record){
        const activeConnections = this.getSession(pkfp);
        activeConnections.forEach((session)=>{
            this.connectionManager.sendServiceRecord(session.getConnectionID(), record)
        })
    }

    broadcastMessage(pkfp, message){
        let session = this.topicToSessionMap[pkfp];
        if(!(session instanceof ClientSession)){
            Logger.debug(`No active sessions found for topic ${pkfp}`, {
                cat: "chat"
            })
            return;
        }

        Logger.verbose("Broadcasting chat message",{
            pkfp: pkfp,
            cat: "session"
        });
        session.broadcast(message);
    }


}

module.exports = ClientSessionManager;
