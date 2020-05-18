const http = require("http");
const io = require("socket.io");

let HOST = 'localhost';
let PORT = 4020;

process.argv.forEach((val, index, array)=>{
	if (val === "-p"){
		PORT = process.argv[index+1];
	} else if(val === "-h"){
		HOST = process.argv[index+1];
	}
})

const server = http.createServer((req, res)=>{
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.write("Hello from simple.io server");
	res.end();
});


server.listen(PORT, HOST, ()=>{
	console.log("Started simple.io server on "+ HOST + ":" + PORT);
});

socket = io.listen(server);


socket.on('connection', (socket)=>{
    console.log("New connection from ");
});
