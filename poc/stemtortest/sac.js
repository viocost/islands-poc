const TorControl = require('tor-control');
const readline = require('readline');






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
     *  keyType
     *  keyContent
     *  discardKey
     *  detached
     *  awaitPublication
     *  basicAuth
     *  maxStreams
     *
     * @returns {Promise}
     */
    createHiddenService(params){

        return new Promise((resolve, reject)=>{
            let KEYTYPES = ["NEW", "RSA1024", "ED25519-V3"];
            let portPattern =/(6553[0-5]|655[0-2][0-9]\d|65[0-4](\d){2}|6[0-4](\d){3}|[1-5](\d){4}|[1-9](\d){0,3}),\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b(:(6553[0-5]|655[0-2][0-9]\d|65[0-4](\d){2}|6[0-4](\d){3}|[1-5](\d){4}|[1-9](\d){0,3}))?/;

            if(!params.hasOwnProperty("port")
                || !params.hasOwnProperty("keyType")
                || !KEYTYPES.includes(params.keyType)
                || !portPattern.test(params.port)
                || (params.keyType !== "NEW" && !params.hasOwnProperty("keyContent"))){
                reject("Invalid request.")
            }
            let request = "ADD_ONION ";

            if (params.keyType === "NEW")
                request += "NEW:RSA1024";
            else
                request += params.keyType +":" + params.keyContent + " ";

            let flags = [];

            if (params.hasOwnProperty("detached"))
                flags.push("detach");
            if (params.hasOwnProperty("discardKey"))
                flags.push("DiscardPK");
            if (params.hasOwnProperty('basicAuth'))
                flags.push("BasicAuth");

            let flagsString = flags.length ===0 ? "" : "Flags=" + flags[0];
            for (let i=1; i<flags.length; ++i){
                flagsString += ("," + flags[i])
            }
            request += flagsString;
            console.log("Message: " + request);
            this.sendCommand(request, (err, response)=>{
                if(err)
                    reject(err, response);
                resolve(response)
            })
        })
    }

    discardHiddenService(){
        return new Promise((resolve, reject)=>{

        })
    }

    listHiddenServices(){

    }



}




console.log("Starting tester program....");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
    prompt: "cli:>"
});


rl.prompt()

rl.on('line', (line)=> {
    line = line.split(" ");

    switch (line[0]) {
        case "hello":
            console.log("Hello bro!");
            break;

        case "cr":
            console.log("Creating hidden service");
            control.sendCommand("")
            break;

        default:
        	console.log("wrong command");

    }
    rl.prompt()

});






