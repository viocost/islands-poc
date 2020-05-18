
const chord = require('./chord');

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



let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

chord.Chord(PORT, 10, onMessage);

console.log("Initialized");


rl.on("line", (line)=>{
    line = line.split(" ");
    switch (line[0]){
        case "hello":
            console.log("Hey buddy!");
            break;



        default:
            console.log("Unrecognized command.");
    }
    rl.prompt("cli:> ");
});


function onMessage(){
    console.log("On message called");
}