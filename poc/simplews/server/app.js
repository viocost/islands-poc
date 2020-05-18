const WebSocket = require('ws');
const http = require("http");

let HOST = 'localhost';
let PORT = 4003;


process.argv.forEach((val, index, array)=>{
	if (val === "-p")
		PORT = array[index+1]
	else if (val === "-h")
		HOST = array[index+1]
})



function startServer(){

	const server = http.createServer((req, res)=>{
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.write("Hello from simplews server");
		res.end();
	});


	server.listen(PORT, HOST, ()=>{
		console.log("Started simplews server on " + getConnectionString());
	});


	ws = new WebSocket.Server({ server });

	ws.on('connection', (ws) => {

		console.log("Got a client connected.");

	    ws.on('message', (message) => {
	        console.log('received: %s', message);
	        ws.send(`Hello, you sent -> ${message}`);
	    });

	    ws.send('Hi there, I am a WebSocket server');
	});



}


startServer();



function getConnectionString(){
	return "http://" + HOST + ":" + PORT
}