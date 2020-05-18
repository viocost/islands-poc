const io = require('socket.io');
const http = require("http");
const TorController = require('./TorController');

let hiddenServiceHOST = '127.0.0.1';
let hiddenServicePORT = 4003;
let torListenerPort = 80;
let torControlHost = '127.0.0.1';
let torControlPort = 9051;
let torControlPassword = 'TheP@$sw0rd';


/**
 *  * @param {string} [opts.host="localhost"] - Host address to tor-control
 * @param {number} [opts.port=9051] - Port of tor-control
 * @param {string} [opts.password=""] - Host address to tor-control (default localhost)
 * @param {string} [opts.path] - Connect by path (alternative way to opts.host and opts.port)
 * @constructor
 */


let controller = new TorController({
    host: hiddenServiceHOST,
    port: torControlPort,
    password: torControlPassword
});


controller.createHiddenService({
    keyType: "NEW",
    port: "80,127.0.0.1:4003",
    detached: true
}).then((response)=>{


}).catch((err)=>{
    console.log("Error creating hidden service: " + err)
});

let server = http.createServer((req, res)=>{
   console.log("Request received!");
   res.writeHead(200, {'Content-Type': 'text/plain'});
   res.write("Hello from TOR test server!\n");
   res.end();

});

server.listen(4003, 'localhost', ()=>{
    console.log("Tor server is listening")
});


let ioserver  = io.listen(server);

ioserver.on('connection', (socket)=>{
    console.log("Received call from client!");
});

