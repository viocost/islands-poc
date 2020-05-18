const WebSocket = require('ws');

let HOST = 'localhost';
let PORT = 4003;

const onion = "t5lowoc4xls7gn6k.onion"
let useOnion = false;

process.argv.forEach((val, index, array)=>{
    if (val === "-p")
        PORT = array[index+1];
    else if (val === "-h")
        HOST = array[index+1];
    else if (val === "-o"){
        useOnion = true
    }
})


function connect(){

	console.log("Connecting to server at " + getConnectionString());

	const ws = new WebSocket (getConnectionString());
	ws.on('open', ()=>{
			console.log("Successfully connected to simplews server.")
	})
	

	ws.on('message', (message)=>{
		console.log("Got a message from server: " + message);
	})




}

connect();




function getConnectionString(){
	return "ws://" + (useOnion ? onion : HOST) + ":" + PORT
}