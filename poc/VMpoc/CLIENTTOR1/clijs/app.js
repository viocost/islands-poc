


const http = require('http'),
      shttp = require('socks5-http-client'),
      request = require('request'),
      readline = require('readline'),
      net = require('net'),
      onionServer = 'http://n3lzxosn6dcguqej.onion',
      process = require('process'),
      io = require('socket.io-client')
      var WebSocket = require('ws'),
      domain = require('domain'),
      sleep = require('sleep'),
      logger = require('winston'),
      SocksProxyAgent = require('socks-proxy-agent'),
      torproxy = require('./proxysocket'),
     // torRouter = require('./tor-router/index'),		

      rl = readline.createInterface({
         input: process.stdin,
         output: process.stdout,
         terminal: false
      });



http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write('Hello World!');
    res.end();
}).listen(4000);

const Agent = require('socks5-http-client/lib/Agent');




console.log("listening on 8080\n\n");

rl.setPrompt("cli:>");
rl.prompt();

rl.on('line', (line)=>{

    switch(line){
        case "hello":
            console.log("Hello buddy!");
            break;
        case "socks":
            connectSocks();
            break;
        case "http":
            connectHTTP();
            break;
        case "http2":
            connectHTTP2();
            break;
        case "httpBoth":
            connectHTTP();
            connectHTTP2();
            break;
        case "http3":
            connectHTTP3();
            break;
        case "net":
            connectNet();
            break;

        case "rt":
        	args = {

        	};
        	goRouter(args);    
        	break;
        case "io":
        	runio();
        	break;	
        case "ws":
        	args = {

        	}
        	gows(args);    
        	break;		
        default:
            console.log("Dude, have no idea what you're talking about!");
            break;
    }

    rl.prompt("cli:> ");
});

function runio(){

	let socket = io.connect('http://n3lzxosn6dcguqej.onion');
	socket.on('connect', function(){
		console.log('Connected!');
	});
	socket.on('event', function(data){});
	socket.on('disconnect', function(){});

}

function gows(args){
	
	let j = 0;
	let url =  'ws://n3lzxosn6dcguqej.onion';

	let agent = new SocksProxyAgent('socks://127.0.0.1:9050');
	let opts = {};
	opts.agent = agent;
	let socket = new WebSocket(url, opts);


	socket.on('message',  (data, flags) => {

	  console.log(data + " " + j);
	  ++j;
	  socket.send('Thanks!');
	});


	socket.on('open',  () =>{
	  console.log('"open" event!');

	  let i=0;
		while (i<10){
			sendOnce(socket, i);
			++i;
			sleep.sleep(randInt(6))
		}
	});

	

	socket.on('close', ()=>{
	   console.log('connection closed!');			
	});




}


function sendOnce(socket, i){
	console.log("Sendigng message to SERVER Island: " + i);
	socket.send(getCurrentDate());
	
}

// function startSendingTimestamps(socket){
// 	{
		
// 		console.log("Sendigng message to SERVER Island: " + i);
// 		socket.send(getCurrentDate());
// 		++i;
// 		sleep.sleep(randInt(6))
// 		if(socket.CLOSED || socket.CLOSING)
//             break;
		

// 	}

// }

function getCurrentDate(){
	d = new Date();
	return d.toString()
}


function randInt (min, max) {
    if (max === undefined) {
        max = min;
        min = 0;
    }

    if (typeof min !== 'number' || typeof max !== 'number') {
        throw new TypeError('Expected all arguments to be numbers');
    }

    return Math.floor(Math.random() * (max - min + 1) + min);
};

function getCurrentDate(){
    d = new Date();
    return d.toString()
}

function goRouter(args){

	// netsocket = new net.Socket({
	// 	readable: true,
	// 	writable: true
	// });

	// netsocket.connect(80, 'n3lzxosn6dcguqej.onion', ()=>{
	// 	sendAuth();
	// })

	var socket = torproxy.create('localhost', 9050);

	socket.connect(80, 'n3lzxosn6dcguqej.onion', (data)=>{
		socket.write('GET /chat/ HTTP/1.1\r\n\r\n');
	});
	socket.on('data',  (data) => {
		// Receive data
		console.log(data.toString());
		
	});

	
}


	
function sendAuth() {
	var request = new Buffer(3);
	request[0] = 0x05;  // SOCKS version
	request[1] = 0x01;  // number of authentication methods
	request[2] = 0x00;  // no authentication

	if (!socket.write(request)) {
		throw new Error("Unable to write to SOCKS socket");
	}
}




function connectNet(){

  const client = net.createConnection({ "port": 80, host: 'google.com' }, () => {
    //'connect' listener
    console.log('connected to server!');
    client.write('world!\r\n');
  });

  client.on('data', (data) => {
    console.log(data.toString());
    client.end();
  });
  client.on('end', () => {
    console.log('disconnected from server');
  });

};






function connectSocks(){
    console.log("About to connect via TOR");
    var client = socks.connect({
      host: onionServer,
      port: 80,
      proxyHost: '127.0.0.1',
      proxyPort: 9050,
      auths: [ socks.auth.None() ]
    }, function(socket) {
      console.log('>> Connection successful');
      //socket.write('GET /node.js/rules HTTP/1.0\r\n\r\n');
      socket.pipe(process.stdout);
    });

}







function connectHTTP2() {
  console.log("\nConnecting via socks HTTP2`!\n");
  request({
  	url: "http://46gkyis5kutv6eqx.onion:82",
  	agentClass: Agent,
  	agentOptions: {
  		socksHost: 'localhost', // Defaults to 'localhost'.
  		socksPort: 9050 // Defaults to 1080.
  	}
  }, (err, res)=> {
  	console.log(err || res.body + "\n\n");
  });

}

function connectHTTP3() {
  console.log("\nConnecting via socks HTTP3`!\n");
  request({
  	url: "http://46gkyis5kutv6eqx.onion:83",
  	agentClass: Agent,
  	agentOptions: {
  		socksHost: 'localhost', // Defaults to 'localhost'.
  		socksPort: 9050 // Defaults to 1080.
  	}
  }, (err, res)=> {
  	console.log(err || res.body + "\n\n");
  });

}



function connectHTTP() {
  console.log("\nConnecting via socks HTTP`!\n");
  request({
  	url: onionServer,
  	agentClass: Agent,
  	agentOptions: {
  		socksHost: 'localhost', // Defaults to 'localhost'.
  		socksPort: 9050 // Defaults to 1080.
  	}
  }, (err, res)=> {
  	console.log(err || res.body + "\n\n");
  });

}
