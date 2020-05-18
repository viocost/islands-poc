const fork = require('child_process').fork;
const path = require('path');
const worker = path.resolve('./tor_worker');
const spawn = require('child_process').spawn;
const exec = require('child_process').exec;
const net = require('net');

class TorConnector{



    constructor(){
        console.log("Initializing...")
        this.connections = [];
        this.messageQueue = [];
        this.controlSocket = null;
        this.CONTROL_PORT = 4008;
        this.initControlPort();
        this.workerConnection = null;

    }

    initControlPort(){
        console.log("Initializing control port...")
        this.controlSocket  = net.createServer((c)=>{
            //Controler connected
            console.log("Worker connected!")
            this.workerConnection = c;
            c.on('error', (err)=>{
                console.error("ERROR FROM WORKER: " + err)
            });
            c.on('end', () => {
                console.log('Tor worker disconnected');
            });

            c.on('data', (data)=>{
                console.log("Received some data.");
                edata = eval(data.toString());

                switch(edata[0]){
                    case "init":
                        initConnection(edata[1]);
                        break;
                    case "send":
                        sendMessage(data[1], edata[2]);
                        break;
                    case "close":
                        closeConnection(edata[1]);
                        break;
                    default:

                        console.log("unrecognized message received by worker: " + edata[0]);
                        break;
                }
                console.log((edata));
            });

        })

        this.controlSocket.listen(this.CONTROL_PORT, 'localhost', ()=>{
            console.log("Controller is listening on " + this.CONTROL_PORT);
        })


    }

    spawnWorker(){
        //spawns torified worker
        console.log("spawning worker");
        this.worker = spawn('torsocks nodejs tor_worker.js -p '+ this.CONTROL_PORT, {
            shell: true
        });

        this.worker.stdout.on('data', (data)=>{
            console.log('=== FROM WORKER: ' + data.toString());;
        })
                /*
        this.worker.stdio[3].on('data', (data)=>{
            edata = eval(data.toString());
            switch(edata[0]){
                default:
                    console.log("FROM WORKER: " + data);
            }


        });
       */
    }

    /*
    control(){
        this.controlSocket = net.Socket()
        this.controlSocket.connect(4007, 'localhost', ()=>{
            console.log("connected to worker successfully!");

        })

        this.controlSocket.on('data', function(data) {
            console.log('Received: ' + data);
            
        });

        this.controlSocket.on('close', function() {
            console.log('Connection closed');
        });
    }
    */

    killWorker(){
        console.log('Killing worker....');
        this.worker.kill();
    }

    workerInfo(){
        console.log(this.worker);
    }

    connect(onion){
        this.toWorker(JSON.stringify(['init', onion]))
    }

    close(onion){
        this.toWorker(JSON.stringify(['close', onion]))
    }

    sendMessage(onion, message){
        this.toWorker(JSON.stringify(['send', onion, message]))
    }

    acceptMessage(){

    }

    toWorker(message){
        if (message){
            console.log("About to write to worker");
            this.workerConnection.write(message);
        } else{
            throw "Message is required.";
        }
    }

    initServer(){
        const controlServer  = net.createServer((c)=>{
            //Controler connected
            console.log('controller connected');
            
            c.on('end', () => {
                console.log('client disconnected');
            });
        });
    }
}

        




module.exports = TorConnector;