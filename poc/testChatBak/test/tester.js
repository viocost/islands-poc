const readline = require('readline');
const Chat = require('./classes/IslandsChat');
let topic;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
    prompt: "cli:>"
});

console.log("Starting tester program....");

rl.on('line', (line)=> {
    line = line.split(" ");

    switch (line[0]) {
        case "hello":
            console.log("Hello bro!");
            break;

        case "initTopic":
            initTopic();
            break;

        case "openTopic":
            openTopic(line[1]);
            break;

        case "ameta":
            appendRandomMetadata(line[1]);
            break;

        case "amess":
            appendRandomMessage(line[1]);
            break;

        case "gmeta":
            getLastMeta();
            break;
        case"gmess":
            getLastMessage();
            break;
        default:
            console.log("Wrong command");
            break;
    }

});


function getLastMeta(){

}

function getLastMessage(){

}


function appendRandomMetadata(){

}

function appendRandomMessage(){

}


function initTopic(){
    topic = getRandomString(16)
    const chat = new Chat();
    chat.initTopic(topic, getRandomString(getRandomInt(0, 500)))

}









function getRandomString(length){
    let alphabet = "1234567890qwertyuiopasdfghjklzxcvbnm";
    let result = "";
    for (let i=0; i< length; ++i){
        result += alphabet[getRandomInt(0, alphabet.length)]
    }
    return result;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}