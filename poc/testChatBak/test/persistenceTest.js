const HistoryManager = require("./classes/libs/HistoryManager.js");
let hm = new HistoryManager("/home/kostia/islandsData/history");


let promises = [];

let blob = '{"signature":"2288cc49e5ffc299d4603f67511077f6b17533815d59a96a3f8b3c3d8b19e451ca3c0f7b941df615803676a1c4884b6c8e0ae7523ba838f1edb57ac3c7c7d18897baf6d68e2649126382f6be09714e7620eec0fc7ae5164dcb14e7298276cfd5cc303b3aec2c31b2739d68b350bf46de8252ecb1e55cadae4042cbdeb8f0320b404cd0b48629ef54b73cc6b5bddb7ee26815d1b832353f124a638bb3aea8abeae386f97e89da43a4b64106d797cbd4894add0eec1c11c5ba551f76757463c5c74ec7ac9ac628a948970a86bd6013433c324dd2ef52bbbc6eec64a0beee0a292ec47a21fa79b07a9cdca6b4661a3a3056dd18c6e15f4d5d55f0c9db7a202ba59f","header":{"id":"e1b87bc180c5814e","timestamp":"2018-09-08T20:01:45.716Z","metadataID":"7d948f9a9c310b9311f4a2070c7bdd69","author":"b7157ef6cd8946bf66da7ae68f26f45b46d63e4f8149af080597e3f7ded385d7","nickname":"005daae863816798a4128e099e0c5e66efbfc5a1af5665bc9d87e48f0a3ec579","recipient":"all"},"body":"b58fe6216768ec6d723c350fd2afe3d64425e64ae0c1bba3946bba063350fb60"}';
let pkfp = "b7157ef6cd8946bf66da7ae68f26f45b46d63e4f8149af080597e3f7ded385d7"
let i=0;


function asyncTest(){

    for (let j = 0; j< 1000; ++j){
        promises.push(hm.appendMessage(blob, pkfp))
    }
    Promise.all(promises)
        .then(()=>{
            console.log("All set");
        })
}


function nextIter(){
    if(i< 30){
        appendMessage();
    }else{
        console.log("All set");
        Promise.all(promises)
            .then(()=>{
                console.log("DONE!");
            });
    }
}

function appendMessage(){
    setTimeout(()=>{
        promises.push(hm.appendMessage(blob, pkfp));
        ++i;
        nextIter();
    }, 20)
}

//appendMessage()
asyncTest()


setTimeout(()=>{
    console.log("script finished");
}, 10000)