//const express = require("express");
//const app = express();
const http = require('http');
const io = require("socket.io")(http);
const ioClient = require("socket.io-client");
const net = require('net');
const PORT = 4003;
let CONTROL_PORT;
let commandSocket;

console.log("parsing args");
process.argv.forEach(function (val, index, array) {
    if (val === "-p"){
         CONTROL_PORT = process.argv[index+1]
         console.log("Set control port " + CONTROL_PORT);
    }
});
console.log("parsed");


let server = http.createServer((req, res)=>{
	res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write('Hello World!');
    res.end();
})

server.listen(PORT, 'localhost', ()=>{
	console.log("HTTP server is listening on " + PORT);
})

/*
app.get("/", (req, res)=>{
    res.send("Hello from express!");
})

const server = app.listen(PORT, '127.0.0.1', ()=>{
    console.log("Express app running on " + PORT);
})

*/

/***INIT COMMAND SOCKET***/

function initCommandSocket(commandSocket){
    try{
        commandSocket  = net.createServer((c)=>{
        //Controler connected
        console.log('controller connected');
        
        c.on('end', () => {
            console.log('controller disconnected');
        });

    })


    commandSocket.on('data', (data)=>{
        handleDataFromController(data);
    });

    commandSocket.listen(controlPORT, 'localhost', ()=>{
        console.log("Worker is listening on " + controlPORT);
    })

    } catch (err){
        console.error("Command socket was not initialized: " + err) ;
    }
    
}

/***CONNECTING TO PARENT****/

function connectToController(controlPort){
    console.log("Connecting to parent to be controlled...");
    try{
        controlSocket = net.Socket()
        controlSocket.connect(controlPort, 'localhost', ()=>{
            console.log("connected to controller successfully! Listening...");

        })

        controlSocket.on('data', function(data) {
            handleDataFromController(data);
            
        });

        controlSocket.on('close', function() {
            console.log('Connection closed');
        });
    }catch(err){
        console.error('Connection to controiller unsuccessfull: ' + err)
    }

}

connectToController(CONTROL_PORT);


io.listen(server);

io.on('connection', (socket)=>{
    console.log("New connection from " + socket.id);
});

function initConnection(onion){
    console.log("Initializing connection with " + onion);
    
    let socket = ioClient(onion, {reconnect:true});
    socket.on("connect", ()=>{
        console.log("Connected to hidden socket!!!\n" + socket);
    })
    socket.on('event', function(data){});
	socket.on('disconnect', function(){});
}

function sendMessage(onion, message){
    console.log("sending message");

}

function closeConnection(onion){
    console.log("closing connection");
}


function handleDataFromController(data){
	console.log("Received some data.");
        edata = eval(data.toString());

        switch(edata[0]){
            case "init":
                initConnection(edata[1]);
                break;
            case "send":
                sendMessage(data[1], edata[2]);
                break;
            case "close":
                closeConnection(edata[1]);
                break;
            default:

                console.log("unrecognized message received by worker: " + edata[0]);
                break;
    }
    console.log((edata));
}



