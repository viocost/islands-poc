const readline = require("readline");
const net = require("net");
const SocksProxyAgent = require('socks-proxy-agent');
const ioClient = require('socket.io-client');
const WebSocket = require("ws");
let http = require("http");
let url = require("url");
//let Agent = require('socks5-https/client/lib/Agent');
let tr = require("tor-request");

let ProxyAgent = require("proxy-agent");

var shttp = require('socks5-http-client');


let proxysocket = require("proxysocket");

const request = require("request");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.setPrompt("cli:>");
rl.prompt();


let endpoint = "bz5r6yt77am2ayvl.onion";


rl.on('line', (line)=>{
    let args = line.split(" ");
    switch(args[0]) {
        case "hello":
            console.log("Hello buddy!");
            break;

        case "hh":

            connectHttp();
            break;


        case "sh":
            connectShttp();
            break;

        case "tr":

            runTr();
            break;

        case "nn":
            proxysocketRun();
            break

        case "io":

            connectSocketIO();
            break;

        case "onion":
            console.log("Setting endpoint to " + args[1]);
            endpoint = args[1];
            break;

        case "ws":
            ws();
            break;


        default:
            console.log("Unknown command: " + args[0]);

    }


});


function connectHttp(){


    console.log("Performing http request to " + endpoint);
    //let agent = proxysocket.createAgent("127.0.0.1", 9050);
    let agent = new ProxyAgent("socks4://127.0.0.1:9050");
    //let agent = new SocksProxyAgent({protocol: "socks5:", hostname: "127.0.0.1", port: 9050});
  //   let agent = new SocksProxyAgent("socks5h://127.0.0.1:9050");
  //
  //   let req = http.request({
  //       hostname: "www.google.com",
  //       port: 80,
  //       agent: agent,
  //       method: 'GET'
  //   }, (res)=>{
  //       console.log("asdadsa")
  //   });
  //
  //   req.on("error", (err)=>{
  //       console.log("Error: " + err)
  //   })



  //
  //   http.get({
  //       hostname: "www.google.com",
  //       port: 80,
  //       agent: agent,
  //       method: 'GET'
  //   }, (res)=>{
  //        console.log("Connected");
  //        res.pipe(process.stdout);
  //    }).on('error', (e) => {
  //        console.error(`Got error: ${e.message}`);
  //    });
    request("https://bz5r6yt77am2ayvl.onion", {agent: agent}, (err, res, body) => {
        if (err){
            console.log("Http request error: " + err);
        } else{
            console.log("Http request connection success!");
            console.log('statusCode:', res && res.statusCode);
            console.log(body)
        }
    });


}


function connectShttp(){
    var Agent = require('socks5-http-client/lib/Agent');
    let agent = new Agent({
        socksHost: 'localhost', // Defaults to 'localhost'.
        socksPort: 9050 // Defaults to 1080.
    });
    http.get({
              hostname: "bz5r6yt77am2ayvl.onion",
              port: 80,
              agent: agent,
              method: 'GET'
          }, (res)=>{
               console.log("Connected");
               res.pipe(process.stdout);
           }).on('error', (e) => {
               console.error(`Got error: ${e.message}`);
           });
    // request({
    //     url: 'http://bz5r6yt77am2ayvl.onion',
    //     agentClass: Agent,
    //     agentOptions: {
    //         socksHost: 'localhost', // Defaults to 'localhost'.
    //         socksPort: 9050 // Defaults to 1080.
    //     }
    // }, function(err, res) {
    //     console.log(err || res.body);
    // });
}


function runTr(){
    console.log("Trying tr");
    tr.request({url: "https://google.com"}, (err, res, body)=>{
        if(err){
            console.log("Connection error: " + err);
        }else{
            console.log(body);
        }
    })
}

function ws(){
    let ep = "ws://" + endpoint;
    console.log("Performing http request to " + ep);
    //let agent = new SocksProxyAgent({protocol: "socks5:", hostname: "127.0.0.1", port: 9050});
    let agent = proxysocket.createAgent("127.0.0.1", 9050);
    var socket = new WebSocket(ep, { agent: agent });

    socket.on('open', function () {
        console.log('"open" event!');

    });

    socket.on("error", (err)=>{
        console.log("WS Error: " + err);
    })
}

function connectSocketIO(){
    //let agent = proxysocket.createAgent("127.0.0.1", 9050);

    var Agent = require('socks5-http-client/lib/Agent');
    let agent = new Agent({
        socksHost: 'localhost', // Defaults to 'localhost'.
        socksPort: 9050 // Defaults to 1080.
    });

    let maxAttempts = 10;
    let attempt = 1;
    let ep = getWSOnionConnectionString(endpoint);
    console.log("Performing socket-io request to " + ep);
    const socket = ioClient(ep, {
        autoConnect: false,
        agent: agent,
        forceNew: true,
        reconnection: false,
        //connection: 'Upgrade',
        //upgrade: 'websocket',
        transports: ['websocket']
    });

    let attemptConnection = ()=>{
        socket.open();
    };

    let timeout = 5000;

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

    socket.on('connect',  () => {
        console.log("Connected!")
    });

    socket.on('connect_error', (err)=>{
        console.log("Connect error: " + err.message);
        handleUnsuccessfullConnectAttempt(err.message);
    });

    socket.on('connect_timeout', (timeout) => {
        console.log("Connection timeout");
    });

    socket.on("disconnect", ()=>{
        console.log("Disconnect");
    });

    attemptConnection();

}


function getWSOnionConnectionString(onion, wss = false){
    let onionPattern = /[a-z0-9]*\.onion/;
    let portPattern = /\:[0-9]{1,5}$/;
    if (!onion || !onion.match(onionPattern))
        throw "getWSOnionConnectionString: Invalid onion address"
    onion = onion.trim();

    return (wss ? "wss://" : "ws://") + onion.match(onionPattern)[0] +
        (onion.match(portPattern) ? onion.match(portPattern)[0] : "");

}


function proxysocketRun(){
    let socket = proxysocket.create("localhost", 9050);
    socket.connect(endpoint, 80,()=>{
        console.log("NET CONNECTED");
    });

    socket.on("error", (err)=>{
        console.log("ERROR: " + err)
    })

}