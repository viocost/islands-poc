const http = require('http');
// const io = require("socket.io")(http);
const ioClient = require("socket.io-client");
const readline = require('readline');
//
// const PORT = 5000;
//
// http.createServer((req, res)=>{
//     res.write('Hello!');
//     res.end();
// }).listen(PORT);
//
// console.log('Listening on ' + PORT);
//
// io.on('connection', (socket)=>{
//     console.log('a user connected')
// });





console.log('2');



rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.prompt("cli:> ");
rl.on('line', (line)=>{
    line = line.split(" ");
    switch(line[0]){
        case "hello":
            console.log("Hello buddy!");
            break;
        case "connect":
            console.log("Connecting to " + line[1]);
            connectionManager(line[1]);
            break;
        default:
            console.log("Dude, have no idea what you're talking about!");
            break;
    }

    rl.prompt("cli:> ");
});

function connectionManager(target) {
    let socket = connect(target);
    if (socket.connected)
        console.log("Connected");
    else
        console.log("Not connected");


}


function connect(target){
    //try to connect
    console.log("connecting...");

    const socket = ioClient.connect(target, {reconnect: true});

    // Add a connect listener
    socket.on('connect', function(socket) {
        console.log('Connected!');
    });
    //if connection successfull - save socket and return socket id

    //if unsuccessfull - return null
    return socket;
}

function sendMessage(){

}


function acceptMessage(){


}