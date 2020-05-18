const TorControl = require('tor-control');
const SocksProxyAgent = require("socks5-http-client/lib/Agent");
const ioClient = require('socket.io-client');
let socksProxyHost = "127.0.0.1";
let socksProxyPort = "9050";

class TorController extends TorControl{
    constructor(opts){
        /**
         * Tor control class
         * @link https://gitweb.torproject.org/torspec.git/tree/control-spec.txt
         * @param {{}} [opts] - Options
         * @param {string} [opts.host="localhost"] - Host address to tor-control
         * @param {number} [opts.port=9051] - Port of tor-control
         * @param {string} [opts.password=""] - Host address to tor-control (default localhost)
         * @param {string} [opts.path] - Connect by path (alternative way to opts.host and opts.port)
         * @constructor
         */
        super(opts)
    }


    /**
     *
     * @param {object} params parameters that contain all options      *
     *  port Must be a string in format "PORT,HOST_IP:PORT"
     *      for example "80,127.0.0.1:5000"
     *  keyType can be "NEW", "RSA1024", "ED25519-V3"
     *  keyContent in raw base64 format
     *  discardKey
     *  detached
     *  basicAuth
     *  maxStreams
     *
     * @returns {Promise}
     */
    createHiddenService(params){
        return new Promise(async (resolve, reject)=>{
            let serviceID;
            let KEYTYPES = ["NEW", "RSA1024", "ED25519-V3"];
            let portPattern =/(6553[0-5]|655[0-2][0-9]\d|65[0-4](\d){2}|6[0-4](\d){3}|[1-5](\d){4}|[1-9](\d){0,3}),\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b(:(6553[0-5]|655[0-2][0-9]\d|65[0-4](\d){2}|6[0-4](\d){3}|[1-5](\d){4}|[1-9](\d){0,3}))?/;

            if(!params.hasOwnProperty("port")
                || !params.hasOwnProperty("keyType")
                || !KEYTYPES.includes(params.keyType)
                || !portPattern.test(params.port)
                || (params.keyType !== "NEW" && !params.hasOwnProperty("keyContent"))){
                reject("Invalid request.");
                return;
            }
            let request = "ADD_ONION ";


            if (params.keyType === "NEW")
                request += "NEW:RSA1024";
            else
                request += params.keyType +":" + params.keyContent + " ";

            let flags = [];


            if (params.detached)
                flags.push("detach");
            if (params.discardKey)
                flags.push("DiscardPK");
            if (params.basicAuth)
                flags.push("BasicAuth");

            let flagsString = flags.length ===0 ? "" : " Flags=" + flags[0];
            for (let i=1; i<flags.length; ++i){
                flagsString += ("," + flags[i])
            }
            request += flagsString;
            request += " port=" +params.port;
            this.sendCommand(request, async (err, response)=>{

                if(err) {
                    console.log("Tor command error " + err);
                    reject(err);
                } else{
                    try{
                        response.messages = this.torMessagesToJSON(response.messages);
                        console.log("Hidden service was launched. ID: " + response.messages.ServiceID);
                        serviceID = response.messages.ServiceID + ".onion";
                        console.log(serviceID)
                        if(!params.awaitPublication){
                            resolve(response);
                            return;
                        } else{

                            await this.awaitPublication(serviceID);
                            resolve(response)
                        }

                    }catch(err){
                        console.log("Error creating hidden service: " + err);
                        reject(err)
                    }
                }

            });


        })
    }

    awaitPublication(service, privateKey, attempts = 10, timeout = 20000){
        return new Promise((resolve, reject)=>{
            console.log("Awaiting publication!");
            let attempt = 0;
            const agent = new SocksProxyAgent({
                socksHost: socksProxyHost,
                socksPort: socksProxyPort
            });
            let endpoint = this.getWSOnionConnectionString(service);

            const socket = ioClient(endpoint + '/chat', {
                autoConnect: false,
                agent: agent,
                forceNew: true,
                reconnection: false,

            });


            let attemptConnection = ()=>{
                console.log("Attempting to connect to hidden peer. Attempt: " + attempt);
                socket.open();
            };

            socket.on('connect', async () => {
                socket.close();
                console.log("Service is available!");
                resolve()
            });

            socket.on('connect_error', (err)=>{
                console.log("TOR connector: connection error: " + err);
                if(attempt < attempts){
                    attempt +=1;
                    setTimeout(()=>{
                        attemptConnection()
                    }, timeout)
                }else{
                    reject()
                }

            });
            attemptConnection();

        })
    }

    getWSOnionConnectionString(onion, wss = false){
        let onionPattern = /[a-z0-9]*\.onion/;
        let portPattern = /\:[0-9]{1,5}$/;
        if (!onion || !onion.match(onionPattern))
            throw new Error("getWSOnionConnectionString: Invalid onion address: " + onion);
        onion = onion.trim();
        return (wss ? "wss://" : "ws://") + onion.match(onionPattern)[0] +
            (onion.match(portPattern) ? onion.match(portPattern)[0] : "");

    }

    torMessagesToJSON(messages){
        let result = {};
        for (let i=0; i<messages.length; ++i){
            let delimiterIndex = messages[i].indexOf('=');
            let key = messages[i].substring(0, delimiterIndex);
            let value = messages[i].substr(delimiterIndex +1);
            if(delimiterIndex !== -1)
                result[key] = value;
        }
        return result;
    }

    async killHiddenService(serviceID){
        let idPattern = /^[a-z2-7]{16}(\.onion)?$/
        serviceID = serviceID.trim().substring(0, 16);
        if(!idPattern.test(serviceID)){
            throw new Error("Invalid service ID");
        }

        let request = "DEL_ONION " + serviceID;

        this.sendCommand(request, (err, response)=>{
            if(err){
                throw new Error(err)
            }
            return response
        })
    }


    listHiddenServices(detached = true){
        return new Promise((resolve, reject)=>{

            let request = "GETINFO " + (detached ? "onions/detached" : "onions/current");

            this.sendCommand(request, (err, response)=>{
                if(err)
                    reject(err);
                try {
                    resolve(response)
                }catch(err){
                    reject(err);
                }
            })
        })
    }

    isHSUp(hsid) {
        return new Promise((resolve, reject) => {
            this.listHiddenServices()
                .then(response=>{
                    let messages = response.messages;
                    hsid = new RegExp(hsid.substring(0, 16));
                    for (let i=0; i<messages.length; ++i){
                        //console.log("Testing " + hsid + " against " + messages[i]);
                        if(hsid.test(messages[i])){
                            console.log("Service "+messages[i] + " is already up!");
                            resolve(true);
                            return;
                        }
                    }
                    console.log("Service is not up");
                    resolve(false);
                })
                .catch(err =>{reject(err)})
        })
    }

    setEvents(events){
        let request = "SETEVENTS ";
        if (typeof(events)!=="object"){
            return this.sendCommandPromise(request + events)
        } else {
            for (let i=0; i<events.length; ++i){
                request += (events[i].trim() + " ")
            }
            return this.sendCommandPromise(request)
        }
    }

    removeAllEvents(){
        return this.sendCommandPromise("SETEVENTS")
    }


    sendCommandPromise(request, keepConnection){
        return new Promise((resolve, reject)=>{
            this.sendCommand(request, (err, response)=>{
                if(err)
                    reject(err);
                resolve(response)
            }, keepConnection)
        })
    }
}

module.exports = TorController;
