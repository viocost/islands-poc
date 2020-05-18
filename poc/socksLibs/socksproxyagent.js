//var WebSocket = require('ws');
const io = require('socket.io-client')



var SocksProxyAgent = require('socks-proxy-agent');
 
// SOCKS proxy to connect to
var proxy = process.env.socks_proxy || 'socks://127.0.0.1:9050';
console.log('using proxy server %j', proxy);
 
// WebSocket endpoint for the proxy to connect to
var endpoint = process.argv[2] || 'ws://t5lowoc4xls7gn6k.onion:80';
console.log('attempting to connect to WebSocket %j', endpoint);
 
// create an instance of the `SocksProxyAgent` class with the proxy server information
var agent = new SocksProxyAgent(proxy);
 
// initiate the WebSocket connection
//var socket = new WebSocket(endpoint, { agent: agent });
let socket = io(endpoint, {agent:agent});
 
socket.on('connect', function () {
  console.log('"open" event!');
  socket.send('hello world');
});
 
// socket.on('message', function (data, flags) {
//   console.log('"message" event! %j %j', data, flags);
//   socket.close();
// });