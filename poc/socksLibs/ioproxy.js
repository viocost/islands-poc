var proxy = require('socket.io-proxy');

proxy.init('http://localhost:9050');
var socket = proxy.connect('ws://t5lowoc4xls7gn6k.onion:80');

socket.on('connect', function () {
    console.log('Socket connected');
    socket.on('command', function (data) {
        console.log('Received data');
    });
    socket.on('disconnect', function() {
        console.log('Socket disconnected');
    });
});