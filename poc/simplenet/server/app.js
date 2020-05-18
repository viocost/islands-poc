const net = require('net');
let HOST = 'localhost';
let PORT = 4003;


process.argv.forEach((val, index, array)=>{
	if (val === "-p")
		PORT = array[index+1]
	else if (val === "-h")
		HOST = array[index+1]
})


const socket = net.createServer((c)=>{
	console.log('Client connected!');

	c.on('end', ()=>{
		console.log('Client disconnected')
	})
})

socket.listen(PORT, HOST, ()=>{
	console.log("LISTENING ON " + getConnectionString())
})

function getConnectionString(){
	return "http://" + HOST + ":" + PORT
}