global.Worker = require("worker_threads").Worker;




//webworker-threads

//let Worker = require("webworker-threads").Worker;

let worker = new Worker(("./worker.js")=>{
    this.onmessage = (ev=>{
        console.log("Received command " + ev.data.command );
        console.log(ev.data);
        let a = new Uint8Array([1, 2, 3, 4, 5]);

        postMessage({response: "ok", data: a})

    })
})


worker.postMessage({command: "BOOOOO"})


worker.onmessage = (ev)=>{
    let res = ev.data.response;
    let data = ev.data.data;
    console.log("Got response! " + res)
    console.log("Buffer: " + new Uint8Array(data));

}

//webworker-threads - END