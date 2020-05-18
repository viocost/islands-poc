# Tor Router

*Tor Router* is a simple SOCKS5 forward proxy for distributing traffic across multiple instances of Tor. At startup Tor Router will run an arbitrary number of instances Tor an each request will be sent to a different instance in round-robin fashion. This can be used to increase anonymity, because each request will be sent on a different circut and will most likely use a different exit-node, and also to increase performance since outbound traffic is now split across several instances of Tor.

Tor Router also includes a DNS forward proxy and a HTTP forward proxy as well, which like the SOCKS proxy will distribute traffic across multiple instances of Tor in round-robin fashion. The HTTP forward proxy can be used to access Tor via an HTTP Proxy.

## Building and Running

Installation requirements are node.js and tor. Make sure "tor" is in your PATH.

To install run: `npm install`
To start run: `bin/tor-router`

To install globally run: `npm install -g`

Alternatively docker can be used. The build will retrieve the latest version of Tor from the offical Tor Project repository.

To build run: `docker build -t znetstar/tor-router .`
To start run: `docker run --rm -it -p 9050:9050 znetstar/tor-router`

## Usage

The following command line switches and their environment variable equivalents are available for use:

|Command line switch|Environment Variable|Description|
|-------------------|--------------------|-----------|
|-c, --controlPort	|CONTROL_PORT        |Port the control server will bind to (see below)|
|-j, --instances    |INSTANCES           |Number of Tor instances to spawn|
|-s, --socksPort    |SOCKS_PORT			 |Port the SOCKS proxy will bind to|
|-d, --dnsPort		|DNS_PORT			 |Port the DNS proxy will bind to|
|-h, --httpPort     |HTTP_PORT			 |Port the HTTP proxy will bind to|
|-l, --logLevel		|LOG_LEVEL			 |The log level, "info" by default. Set to "null" to disable logging|


For example: `tor-router -j 3 -s 9050` would start the proxy with 3 tor instances and listen for SOCKS connections on 9050.

## Control Server

A JSON-RPC 2 TCP Server will listen on port 9077 by default. Using the rpc server the client can add/remove Tor instances and get a new identity (which includes a new ip address) while Tor Router is running.

Example (in node):

```
	var net = require('net');

	const client = net.createConnection({ port: 9077 }, () => {
		var rpcRequest = {
			"method": "createInstances",
			"params": [3], 
			"jsonrpc":"2.0", 
			"id": 1
		};
		client.write(JSON.stringify(rpcRequest));
	});

	client.on('data', (chunk) => {
		var rawResponse = chunk.toString('utf8');
		var rpcResponse = JSON.parse(rawResponse);
		console.log(rpcResponse)
		if (rpcResponse.id === 1) {
			console.log('Three instances have been created!')
		}
	})
```

## Test

Tests are written in mocha, just run `npm test`