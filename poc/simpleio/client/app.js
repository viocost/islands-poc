const io = require("socket.io-client");

let HOST = 'localhost';
let PORT = 4020;
let onion = "t5lowoc4xls7gn6k.onion";
let useOnion = false;

process.argv.forEach((val, index, array)=>{
	if (val === "-p"){
		PORT = array[index+1];
	} else if(val === "-h"){
		HOST = array[index+1];
	}else if(val === "-o"){
		useOnion = true;
	}
})

console.log("connecting..." + getConnectionString());
let socket = io(useOnion ? onion : getConnectionString());

socket.on("connect", ()=>{
        console.log("Successfully connected to simple.io server!\n");
    })
socket.on('event', function(data){});
socket.on('disconnect', function(){});


function getConnectionString(){
	return "http://" + HOST + ":" + PORT
}