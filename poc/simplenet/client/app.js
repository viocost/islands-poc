const net = require('net');
let HOST = 'localhost';
let wrapper = require('socks-wrapper')
let PORT = '4003';
const onion = "t5lowoc4xls7gn6k.onion"
let useOnion = false;

const SocksProxyAgent = require('socks-proxy-agent');
const proxy = process.env.socks_proxy || 'socks://127.0.0.1:9050';


process.argv.forEach((val, index, array)=>{
    if (val === "-p")
        PORT = array[index+1];
    else if (val === "-h")
        HOST = array[index+1];
    else if (val === "-o"){
        useOnion = true
    }
})




console.log("Connecting to server...");
try{
    let agent = new SocksProxyAgent(proxy)
    socket = net.Socket({agent: agent})

    socket.connect(PORT, onion, ()=>{
        console.log("connected to server successfully!");
    })

    
    socket.on('close', function() {
        console.log('Connection closed');
    });
}catch(err){
    console.error('Connection to server unsuccessfull: ' + err)
}


function getConnectionString(){
    return "http://" + (useOnion ? onion : HOST) + ":" + PORT
}