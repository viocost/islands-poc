const SocketIO = require('socket.io');
const EventEmitter = require('events');
const ID_SIZE = 6
const Err = require("./IError.js");
const Logger = require("./Logger.js");

/**
 * Manages client->island connections
 * adds and removes listeners
 * keeps track of active sockets
 */
class ClientConnectionManager extends EventEmitter{

    constructor(server = Err.required("Missing required parameter.")){
        super();
        this.io = SocketIO.listen(server);
        this.socketHub = this.io.of("/chat");
        this.dataSocketHub = this.io.of("/file");
        this.setListeners();
    }

    /**
     * Sets standard event handlers for
     */
    setListeners(){
        let self = this;

        self.socketHub.on('connection', (socket) => {
            console.log(`SOCKET HUB CONNECTION: socket id: ${socket.id}`)
            self.emit("client_connected", socket.id);
            socket.on("disconnect", (reason)=>{
                console.log("Client disconnected: " + socket.id)
                self.emit("client_disconnected", socket.id)
            });

            socket.on('reconnect', (attemptNumber) => {
                self.emit("client_reconnected", socket.id)
            });

            socket.on("ping", ()=>{
                console.log("RECEIVED PING FROM CLIENT")
                socket.emit("pong");
            })

            socket.on("error", (err)=>{
                Logger.error(`Client socket error: ${err.message}`, {stack: err.stack});
            })

        });

        self.dataSocketHub.on('connection', (socket)=>{
            console.log("File socket connected");
            self.emit("data_channel_opened", socket);
            console.log("After data_channel_opened emit")
            socket.on("disconnect", (reason)=>{
                self.emit("data_channel_closed", socket.id);
            });

            socket.on("reconnect",  (attemptNumber) => {
                self.emit("data_channel_reconnection", socket.id);
            })

            socket.on("error", (err)=>{
                Logger.error("Data socket error: " + err)
            })

        })
    }

    isAlive(socketId){
        return (this.socketHub.sockets[socketId] && this.socketHub.sockets[socketId].connected);
    }

    getSocketById(id){
        if(!this.socketHub.sockets[id]){
            Logger.error(`Socket not found: ${id}, \nExisting sockets: ${JSON.stringify(Object.keys(this.socketHub.sockets))}`, {cat: "connection"})
            throw new Error("Socket does not exist: " + id);
        }
        return this.socketHub.sockets[id];
    }

    getDataSocketById(id){
        if(!this.dataSocketHub.sockets[id]){
            throw new Error("Socket does not exist: " + id);
        }
        return this.dataSocketHub.sockets[id];
    }

    sendMessage(connectionId, message){
        this.send(connectionId, "message", message);
    }

    /**
     *
     * @param message
     * @param data: arbitrary object
     * @param connectionId - translates to socketID
     */
    send(connectionId = Err.required("Missing required parameter connectionId"),
         message = Err.required("Missing required parameter message"),
         data = Err.required("Missing required parameter data")){
        let client = this.getSocketById(connectionId);
        if(!client || !client.connected){
            throw new Error("Error sending message: client is not connected.");
        }

        client.emit(message, data);
    }

}


module.exports = ClientConnectionManager;
