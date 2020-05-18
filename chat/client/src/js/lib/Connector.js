import * as io from "socket.io-client";
import { WildEmitter } from "./WildEmitter";
import { Internal } from "../../../../common/Events";
import * as CuteSet from "cute-set";

export class Connector{
    constructor(connectionString){
        WildEmitter.mixin(this);
        this.chatSocket;
        this.socketInitialized = false;

        //Defining transitions
        this.possibleTransitions = {}
        this.possibleTransitions[ConnectionState.DISCONNECTED] = new CuteSet([ConnectionState.CONNECTING, ConnectionState.RECONNECTING])
        this.possibleTransitions[ConnectionState.CONNECTING] = new CuteSet([ConnectionState.ERROR, ConnectionState.CONNECTED]);
        this.possibleTransitions[ConnectionState.RECONNECTING] = new CuteSet([ConnectionState.ERROR, ConnectionState.CONNECTED]);
        this.possibleTransitions[ConnectionState.ERROR] = new CuteSet([ConnectionState.CONNECTING, ConnectionState.RECONNECTING, ConnectionState.DISCONNECTED])
        this.possibleTransitions[ConnectionState.CONNECTED] = new CuteSet([ConnectionState.ERROR, ConnectionState.DISCONNECTED]);

        //Initial state
        this.state = ConnectionState.DISCONNECTED;

        if (connectionString){
            this.connectionString = connectionString;
        } else {
            this.connectionString = ""
        }
    }

    transitionState(connState){
        if(!this.possibleTransitions[this.state].has(connState)){
            throw new Error(`Cannot transition from ${this.state} to ${connState}`)
        }
        this.state = connState;
        this.emit(Internal.CONNECTION_STATE_CHANGED, this.state);
    }

    async establishConnection(vaultId, connectionAttempts = 7, reconnectionDelay = 5000){
        return new Promise((resolve, reject)=>{
            let self = this;

            let upgrade = !!this.upgradeToWebsocket;
            if (self.chatSocket && self.chatSocket.connected){
                resolve();
                return;
            }

            let attempted = 0;
            let pingPongCount = 0;
            let maxUnrespondedPings = 10;
            function attemptConnection(){
                console.log("Attempting island connection: " + attempted);

                self.transitionState(ConnectionState.CONNECTING);
                self.chatSocket.open()

            }

            const socketConfig = {
                query: {
                    vaultId: vaultId
                },
                reconnection: false,
//                forceNew: true,
                autoConnect: false,
                //pingInterval: 10000,
                //pingTimeout: 5000,
                upgrade: upgrade
            }


            socketConfig.upgrade = self.transport > 0;

            self.chatSocket = io(`${this.connectionString}/chat`, socketConfig);

            //Wildcard fix
            let onevent = self.chatSocket.onevent;
            self.chatSocket.onevent = function(packet){
                let args = packet.data || [];
                onevent.call(this, packet);
                packet.data = ["*"].concat(args);
                onevent.call(this, packet)
            }
            //End

            self.chatSocket.on("ping", ()=>{
                pingPongCount++;
                if (pingPongCount > maxUnrespondedPings){
                    console.log("chatSocket pings are not responded. Resetting connection");
                    self.chatSocket.disconnect();
                    attempted = 0
                    setTimeout(attemptConnection, reconnectionDelay)
                }
            })

            self.chatSocket.on("pong", ()=>{
                pingPongCount = 0;
            })

            self.chatSocket.on('connect', ()=>{
                self.transitionState(ConnectionState.CONNECTED);

                if(self.socketInitialized){
                    console.log("Socket reconnected");
                    return;
                }

                //SOCKET INITIAL SETUP
                self.socketInitialized = true;
                console.log("Island connection established");

                self.chatSocket.on("*", (event, data)=>{
                    console.log(`Got event: ${event}`);
                    self.emit(event, data);
                })

                self.chatSocket.on('reconnecting', (attemptNumber)=>{
                    console.log(`Attempting to reconnect : ${attemptNumber}`)
                })

                self.chatSocket.on('reconnect', (attemptNumber) => {
                    console.log(`Successfull reconnect client after ${attemptNumber} attempt`)
                    self.transitionState(ConnectionState.CONNECTED)
                });

                self.chatSocket.on('error', (err)=>{

                    self.transitionState(ConnectionState.ERROR);
                    console.error(`Socket error: ${err}`)
                    attempted = 0;
                    console.log("Resetting connection...")
                    setTimeout(attemptConnection, reconnectionDelay)
                })
                resolve();
            });

            self.chatSocket.on("disconnect", ()=>{
                self.transitionState(ConnectionState.DISCONNECTED);

                console.log("Island disconnected.");
                attempted = 0
                setTimeout(attemptConnection, reconnectionDelay);
            });

            self.chatSocket.on('connect_error', (err)=>{
                self.transitionState(ConnectionState.ERROR);
                if (attempted < connectionAttempts){
                    console.log("Connection error on attempt: " + attempted + err);
                    attempted += 1;
                    setTimeout(attemptConnection, reconnectionDelay);
                } else {
                    console.log('Connection Failed');
                    reject(err);
                }

            });

            self.chatSocket.on('connect_timeout', (err)=>{
                self.transitionState(ConnectionState.ERROR);
                console.log('Chat connection timeout');
                reject(err);
            });

            attemptConnection();
        })
    }


    isConnected(){
        return this.chatSocket.connected;
    }

    send(msg){
        if(!this.isConnected()){
            console.error("Socket disconnected. Unbale to send message.");
            this.emit(Internal.CONNECTION_ERROR, msg);
            return
        }


        try{
            this.chatSocket.send(msg);
            console.log("Message sent!");
        }catch (err){
            console.error(`Internal error sending message: ${err.message}`);
            this.emit(Internal.CONNECTION_ERROR, msg);
        }

    }
}

export const ConnectionState = {
    DISCONNECTED: 1,
    CONNECTED: 2,
    CONNECTING: 3,
    RECONNECTING: 4,
    ERROR: 5
}
