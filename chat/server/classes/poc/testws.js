const WebSocket = require('ws');
let server;



module.exports.init = function(server){
    ws = new WebSocket.Server({ server });
    ws.on('connection', (ws) => {

        console.log("Got a client connected.");

        ws.on('message', (message) => {
            console.log('received: %s', message);
            ws.send(`Hello, you sent -> ${message}`);
        });

        ws.send('Hi there, I am a WebSocket server');
    });
};