const express = require('express'),
      app = express(),
      net = require('net'),
      PORT = 4001,
      //server = net.createServer()
      socks = require('socksv5'),
      srv = socks.createServer((info, accept, deny)=>{
        accept();
      });

// srv.listen(PORT, 'localhost', ()=>{
//   console.log('SOCKS server listening on port ' + PORT);
// })
//
// srv.useAuth(socks.auth.None());


 app.get('/', (req, res)=>{
   console.log(req.headers.host);
   res.send("Hello from TOR!\n" + req.headers.host);
 })

 app.listen(4001, "localhost", ()=>{
   console.log("Listening on 4001!\n" );
 })
//
//



//
// server.listen({port:4001, address:"127.0.0.1"}, ()=>{
//   console.log("server listening to %j", server.address());
// })
//
// server.on('connection', (conn)=>{
//   console.log("\x1b[42m", "Got a connection!!!\n");
//   console.log(conn);
// })
