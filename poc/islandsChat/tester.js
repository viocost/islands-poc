const TorConnector = require('./classes/TorConnector');
const readline = require('readline');
const hiddenService = "t5lowoc4xls7gn6k.onion"

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: false,
	prompt: "cli:>"
})

console.log("Starting tester program....");


let tc = new TorConnector();




rl.on('line', (line)=>{
	line = line.split(" ");

	switch(line[0]){
		case "hello":
			console.log("Hello bro!");
			break;


		case "call":
			console.log("Calling hidden island at ") + hiddenService;
			tc.callPeer(hiddenService);
			break;

		case "send":
			console.log("Send broadcast message to hidden island");
			if (line[1])
				tc.broadcast(line[1])
			else
				console.log("message required!");
			break;

		case "hangup":
			console.log("Closing connection");
			break;	


		case "conns":
			console.log("Printing current connections...");
			tc.printCurrentConnections();
			break		
		default:
			console.log("Unknown command...")		

	}


	rl.prompt()
})


rl.prompt();