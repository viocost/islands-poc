document.addEventListener('DOMContentLoaded', function(event){
    document.querySelector("#bootstrap").onclick = bootstrap;
});

function bootstrap(){
    console.log("Running bootstrap")

    let magnet = document.querySelector("#magnet").value;
    if (magnet.length === 0){
        alert("Please paste magnet link for manifest.");
        return;
    }

    // let socket = new WebSocket(`ws://localhost:4000/echo`);

    // socket.onopen = ()=>{
    //         console.log("Socket opened")

    //         let processStatusUpdate = (ev)=>{
    //             console.log(`Status update: ${msg.status}, progress: ${msg.progress || "N/A"}`)
    //         }

    //         let processError = ()=>{
    //             let msg = JSON.parse(ev.data);
    //             console.log(`Status update: ${msg.status}, progress: ${msg.progress || "N/A"}`)
    //         }

    //         let success = ()=>{

    //         }

    //         let processMessage = (ev)=>{
    //             let handlers = {
    //                 statusUpdate: processStatusUpdate,
    //                 error: processError,
    //                 success: success
    //             }

    //             let msg = JSON.parse(ev.data);


    //             if (!msg.command || !handlers.hasOwnProperty(msg.command)){
    //                 console.error(`Invalid request: ${msg.command}`)
    //                 return;
    //             }

    //             handlers[msg.command](socket, msg.data);
    //         }

    //         socket.onmessage = processMessage;
    //         socket.send(JSON.stringify({
    //             command: "bootstrap",
    //             data: {
    //                 magnet: magnet
    //             }
    //         }))

    // }
    // return;
    let xhr = new XMLHttpRequest();
    xhr.open("POST", "/bootstrap");
    xhr.setRequestHeader("Content-type", "application/json;charset=UTF-8");

    xhr.onreadystatechange = function(){
        if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200){
            processBootstrapRes(xhr);
        }
    }

    let data = JSON.stringify({
        magnet: magnet
    })

    xhr.send(data);

}

function processBootstrapRes(xhr){
    console.log(`Response: ${xhr.response}, text: ${xhr.responseText}`)

}
