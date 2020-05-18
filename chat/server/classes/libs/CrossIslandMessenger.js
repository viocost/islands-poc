const EventEmitter = require("events");
const Err = require("./IError.js")
const Envelope = require("../objects/CrossIslandEnvelope.js");
const Logger = require("../libs/Logger.js");
const Multiqueue = require("../libs/Multiqueue.js");


class CrossIslandMessenger extends EventEmitter{
    constructor(connector = Err.required()){
        super();
        this.connector = connector;
        this._crossIslandMessageQueue = new Multiqueue();
        this._setConnectorListeners();
    }

    /**
     * Attempts to send given envelope asynchronously.
     * The function will resolve once envelope is enqueued.
     * Next it will check connection with the endpoint.
     * If connection is already established
     * If not established - it will try to establish new connection.
     *
     * Returns promise whether sent attempt was successfull.
     *
     * @arg envelope: CrossIslandEnvelope - envelope to send
     * @arg timeout: number in milliseconds. Undefind by default.
     *         If envelope has not been delivered to the addressee before timeout expired
     *         the envelope will be removed from the queue and onTimeout callback will be called.
     * @arg onTimeout: - callback(envelope) will be called if timeout expires
     */
    async send(envelope, timeout, onTimeout){
        Logger.debug("Crossisland messenger: sending envelope")
        await this._crossIslandMessageQueue.enqueue(envelope.destination, envelope, timeout, onTimeout);

        Logger.debug("Calling hidden peer to send the message. Dest: " + envelope.destination)
        this._checkConnection(envelope.destination, envelope.origin);
    }




    _checkConnection(dest, orig, numberOfAttempts = 7, timeout = 7000){
        this.connector.callPeer(dest, orig, numberOfAttempts, timeout)
    }

    _setConnectorListeners(){
        this.connector.on("connection_established", async residence =>{
            Logger.debug("Connection is established with: " + residence);
            await this._sendAwaitingMessages(residence);
        });
        this.connector.on("connection_error", data =>{
            Logger.error("Connection error: " + JSON.stringify(data));
            this.processConnectionError(data)
        });


        this.connector.on("message", envelope=>{
            if (envelope.return){
                Logger.warn("Return envelope received", {
                    origin: envelope.origin,
                    dest: envelope.destination,
                    command: this.getMessageCommand(envelope)
                });

                this.emit("return_" +  this.getMessageCommand(envelope), envelope);
            }else if (envelope.response){
                Logger.verbose("Response envelope received", {
                    origin: envelope.origin,
                    dest: envelope.destination,
                    command: this.getMessageCommand(envelope)
                });
                this.emit(this.getMessageResponse(envelope), envelope);
            }else{
                Logger.verbose("Envelope received", {
                    origin: envelope.origin,
                    dest: envelope.destination,
                    command: this.getMessageCommand(envelope)
                });
                this.emit(this.getMessageCommand(envelope), envelope);
            }
        });
        this.connector.on("error", (envelope, err)=>{
            Logger.error("Tor connector error.",{
                error: err
            });
        })
    }


    async _sendAwaitingMessages(destination){
        Logger.debug("Connection established. Processing queue", {destination: destination});

        let queue = this._crossIslandMessageQueue.get(destination);

        if (queue === undefined || queue.isEmpty()){
            Logger.debug("No messages to send to " + destination);
            return
        }

        Logger.debug("Got queue: " + queue);
       
        while(!queue.isEmpty()){

            let envelope = await queue.dequeue()
            Logger.debug("Envelope is dequeued: " + JSON.stringify(envelope));
            try{
                await this.connector.sendDirectly(envelope);
                if(typeof envelope.onDelivered === "function"){
                    envelope.onDelivered();
                }
            }catch(err){
                Logger.error("Error while sending a message. Will try to re-establish connection", {destination: destination, error: err.message});
                this._checkConnection(envelope.origin, envelope.destination)
                if (typeof envelope.onError === "function"){
                    envelope.onError();
                }
            }
        }
        Logger.debug("Queue has been processed for:" + destination);
    }

    processConnectionError(data){
        //TODO remove this thing as now it will be handled by timeout callback.
        Logger.debug("Error establishing a connection to hidden endpoint", {
            origin: data.origin,
            destination: data.destination,
            maxAttempts: data.maxAttempts,
            attempts: data.attempts,
            error: data.error
        });
        if(!this._crossIslandMessageQueue[data.destination] || this._crossIslandMessageQueue[data.destination].length === 0){
            return
        }
        this._crossIslandMessageQueue[data.destination] = this._crossIslandMessageQueue[data.destination].filter(envelope=>{
            if (envelope.returnOnConnectionFail){
                this.returnEnvelopeOnConnectionFail(envelope, data.error);
            }
            return !(envelope.returnOnConnectionFail);
        });
    }


    returnEnvelopeOnConnectionFail(envelope, errMsg){
        envelope.setReturn("Endpoint is unreachable: " + errMsg);
        this.emit("return_" +  this.getMessageCommand(envelope), envelope);
    }


    async returnEnvelope(originalEnvelope, err){
        let logmsg = "Island is returning envelope origin: " + originalEnvelope.origin +
                " dest: " + originalEnvelope.destination +
            " error: " + err;
        if (originalEnvelope.payload
            && originalEnvelope.payload.headers
            && originalEnvelope.payload.headers.command){
            logmsg += (" command: " + originalEnvelope.payload.headers.command);
        }
        Logger.warn(logmsg);
        const envelope = Envelope.makeReturnEnvelope(originalEnvelope, err);
        await this.send(envelope);
    }


    getMessageCommand(envelope){
        while(envelope.payload){
            envelope = envelope.payload;
        }
        const message = envelope;
        return message.headers.command;
    }


    getMessageResponse(envelope){
        while(envelope.payload){
            envelope = envelope.payload;
        }
        const message = envelope;
        return message.headers.response;
    }


    _printOutgoingEnvelope(envelope){
        if (envelope.return){
            console.log("\n================= SENDING RETURN ENVELOPE ============ ");
            console.log("    Origin: " + envelope.origin);
            console.log("    Destination: " + envelope.destination);
            console.log("    command: " + this.getMessageCommand(envelope) + "\n\n");
        }else if (envelope.response){
            console.log("\n================= SENDING RESPONSE ============ ");
            console.log("    Origin: " + envelope.origin);
            console.log("    Destination: " + envelope.destination);
            console.log("    command: " + this.getMessageCommand(envelope));
            console.log("    response: " + this.getMessageResponse(envelope) + "\n\n");
        }else{
            console.log("\n================= SENDING MESSAGE ============ ");
            console.log("    Origin: " + envelope.origin);
            console.log("    Destination: " + envelope.destination);
            console.log("    command: " + this.getMessageCommand(envelope) + "\n\n");
        }
    }

    _printIncomingEnvelope(envelope){
        if (envelope.return){

            console.log("\n================= RECEIVED RETURN ENVELOPE ============ ");
            console.log("    Origin: " + envelope.origin);
            console.log("    Destination: " + envelope.destination);
            console.log("    command: " + this.getMessageCommand(envelope) + "\n\n");
        }else if (envelope.response){
            console.log("\n================= RECEIVED RESPONSE ============ ");
            console.log("    Origin: " + envelope.origin);
            console.log("    Destination: " + envelope.destination);
            console.log("    command: " + this.getMessageCommand(envelope));
            console.log("    response: " + this.getMessageResponse(envelope) + "\n\n");
        }else{
            console.log("\n================= RECEIVED MESSAGE ============ ");
            console.log("    Origin: " + envelope.origin);
            console.log("    Destination: " + envelope.destination);
            console.log("    command: " + this.getMessageCommand(envelope) + "\n\n");
        }
    }

}

module.exports = CrossIslandMessenger;
