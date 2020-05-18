const ioClient = require('socket.io-client');
const io = require('socket.io');

const SocksProxyAgent = require('socks-proxy-agent');
const proxy = process.env.socks_proxy || 'socks://127.0.0.1:9050';
const http = require("http");


process.argv.forEach((val, index, array)=>{
    if (val === "-p"){
        PORT = process.argv[index+1];
    } else if(val === "-h"){
        HOST = process.argv[index+1];
    }
})




class TorConnector{
    constructor(localConnections){

        //Set all the variables
        console.log("Initializing tor connector")

        this.httpHOST = 'localhost';
        this.httpPORT = 4003;

        this.connections = [];
        this.messageQueue = [];

        this.socket = null;

        //init listening server for accepting incoming connections
        
    }


    //init listening server for accepting incoming connections
    initServer(){

        const httpServer = http.createServer((req, res)=>{
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.write("OOOPS... You found nothing here.... Keep looking!");
            res.end();
        });

        httpServer.listen(this.httpPORT, this.httpHOST, ()=>{
            console.log('Onion services are listening on ' + this.getConnectionString());
        });

        this.socket = io.listen(httpServer);

        this.socket.on('connection', (s)=>{
            this.acceptCall(s);            
        })

    }

    emit(event, data){
        io.sockets.emit(event, data);
    }


    //Connect to peer that listening on a hidden service (onion) 
    //and save the connection int he list of current connections
    //
    callPeer(onion){
        const agent = new SocksProxyAgent(proxy);

        const endpoint = this.getWSOnionConnectionString(onion);
        const socket = ioClient(endpoint, {agent:agent});

        this.addStandardListeners(socket);


    }

    //Accept a call from a peer 
    //and save the connection in the list of current connections
    acceptCall(socket){
        console.log("Got new connection from: " + socket.id);
        id = socket.id;
        this.connections.push({id : socket});
        io.sockets[id] = socket;
    }

    //Accept incomnig message and append it to a queue
    acceptIncomingMessage(){


    }


    //Sends message to peer. The connection should be open.
    sendMessage(){

    }

    //close the connection with peer
    hangup(){

    }

    addStandardListeners(socket){
        socket.on('connect',  () => {
            console.log('Successfully connected to hidden peer' + socket);
            this.connections.push(socket);
        });

        socket.on("message", (message)=>{
            console.log("Got message from peer " + message);
        })

    }

    getWSOnionConnectionString(onion, wss = false){
        let onionPattern = /[a-z0-9]*.onion/;
        let portPattern = /\:[0-9]{1,5}$/;
        if (!onion || !onion.match(onionPattern))
            throw "getWSOnionConnectionString: Invalid onion address"
        onion = onion.trim();

        return (wss ? "wss://" : "ws://") + onion.match(onionPattern)[0] + 
            (onion.match(portPattern) ? onion.match(portPattern)[0] : "");

    }


    getConnectionString(){
        return "http://" + this.httpHOST + ":" + this.httpPORT
    }
}

module.exports = TorConnector;

 
// WebSocket endpoint for the proxy to connect to
//var endpoint = process.argv[2] || 'ws://t5lowoc4xls7gn6k.onion:80';
//console.log('attempting to connect to WebSocket %j', endpoint);
 
// create an instance of the `SocksProxyAgent` class with the proxy server information

 
// socket.on('message', function (data, flags) {
//   console.log('"message" event! %j %j', data, flags);
//   socket.close();
// });
