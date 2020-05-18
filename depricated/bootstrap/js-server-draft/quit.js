
let exit = false

function think(){
    if (exit){
        console.log("Exit is true")
        return;
    }
    console.log("thinking");
    setTimeout(think, 5000)
}

process.on("SIGINT", ()=>{
    console.log("Interrupted. Exiting");
    exit = true;
    process.kill(process.pid)
})


think();
