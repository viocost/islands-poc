const SocksClient = require('socks').SocksClient;
const net = require('net');
let HOST = 'localhost';
let PORT = 4003;




const socket = net.createServer((c)=>{
    console.log('Client connected!');

    c.on('end', ()=>{
        console.log('Client disconnected')
    })
})





const options = {
  proxy: {
    ipaddress: '103.216.82.45',
    port: 6667,
    type: 5 // Proxy version (4 or 5)
  },

   command: 'connect', // SOCKS command (createConnection factory function only supports the connect command)

  destination: {
    host: 'dfgdgfjdfdsfgd.com', // github.com (hostname lookups are supported with SOCKS v4a and 5)
    port: 80
  }
};

 async function tryConnection (){
   try{
       let info = await SocksClient.createConnection(options)
       console.log("Connected! " + info.socket);

       info.socket.on("error", ()=>{
           console.log("Socket error");
       })


       info.socket.on("established", ()=>{
           console.log("Established");
       })
       info.socket.connect()
   }catch(er){
     console.trace(er)
   }


};





socket.listen(PORT, HOST, async ()=>{
    console.log("trying")
  await tryConnection();
    console.log("done")
})