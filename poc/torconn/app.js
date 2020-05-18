//const http = require('http');
const TorConnector = require('./TorConnector');
const readline = require('readline');
const PORT = 4002;
/*
let server = http.createServer((req, res)=>{
    res.write("There is nothing here... Go away!");
    res.end();
});

server.listen(PORT);
console.log("running on port " + PORT);
*/

let tc = new TorConnector();

let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});



rl.on("line", (line)=>{
   line = line.split(" ");
   switch (line[0]){
       case "hello":
           console.log("Hey buddy!");
           break;
   
       case "init":
           //tc.connect("t5lowoc4xls7gn6k.onion");
           console.log("")
           tc.initServer()
           break;
       case "call":
          console.log("calling peer: " + line[1])    
          tc.callPeer(line[1] || "t5lowoc4xls7gn6k.onion");

       case "send":
           tc.sendMessage("adwrnzf2dgmut3la.onion", "BOOOO");
           break;
       case "close":
           tc.close("adwrnzf2dgmut3la.onion");
           break;

       default:
           console.log("Unrecognized command.");
   }
   rl.prompt("cli:> ");
});
