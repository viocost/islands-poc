this.onmessage = (ev)=>{
    console.log("got message in worker, sending hello");
    postMessage(["hello"])
}