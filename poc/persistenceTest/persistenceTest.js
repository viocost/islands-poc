
const fs = require("fs");


let promises = [];

let blob = '';
let path = "/home/kostia/islands/poc/persistenceTest/historytest.txt";
let i=0;


/**
 * Returns wrapup record as utf8 String.
 * if endPos is not specified - it gets last record in the history file
 * which is last 64 bytes.
 * @param pkfp
 * @param endPos
 */
function getWrapupBlob(pkfp, endPos, type = "history"){
    return new Promise((resolve, reject)=>{
        endPos = endPos ? endPos - 64 : undefined;
        if (endPos < 0) {
            reject("Invalid start position for the history element");
            return;
        }
        getHistoryElement(64, endPos, pkfp, type)
            .then((buffer)=>{
                resolve(buffer.toString('utf8'));
            })
            .catch((err) =>{
                reject(err);
            })
    })
}



/**
 * Returns a promise of history element as uint8 buffer, no encoding
 * @param {number}length - length of the history element
 * @param {number}start - start position in the history file
 * @param pkfp
 */
function getHistoryElement(length, start, pkfp, type = "history"){
    //console.log("getHistoryElement pkfp: " + pkfp);
    return new Promise((resolve, reject)=>{
        length = parseInt(length);


        fs.stat(path, (errStat, stats)=>{
            if (errStat) {
                reject(errStat);
                return;
            }
            else if(!stats) {
                reject("History file does not exist");
                return;
            }

            fs.open(path, 'r', (errOpen, fd)=>{
                console.log("Opened!");
                if (errOpen) reject(errOpen);
                start = typeof(start) !== "undefined" ? parseInt(start) : stats.size - length;
                fs.read(fd, Buffer.alloc(length), 0, length, start, (errRead, bytes, buffer )=>{
                    console.log("Read");
                    if (errRead) reject(errRead);
                    fs.close(fd, ()=>{
                        resolve(buffer);
                    });

                })
            })
        })
    });
}



function appendHistory(path, blob){
    return new Promise((resolve, reject)=>{
        fs.appendFile(path, blob, (err)=>{
            if (err) {
                reject(err);
            } else{
                resolve();
            }
        });
    });
}


function nextIter(){
    if(i< 30){
        appendMessage(i);
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
        blob = JSON.stringify({string:"Hello world", num: i}) + "\n"
        promises.push(appendHistory(path, blob ));
        ++i;
        nextIter();
    }, 20)
}

function appendWithRead(blob){
    return new Promise((resolve, reject)=>{
        getWrapupBlob()
            .then(wrapupBlob =>{
                return appendHistory(path, blob);
            })
            .then(()=>{
                console.log("Masdaessage was appended successfully.");
                resolve();
            })
            .catch(err =>{
                reject(err);
            })
    })
}

function asyncAppend(){
    for (let i=0; i< 600; ++i){
        blob = "111111111111111111111111111111111111111111111111111111111111111111111111111\n"
        promises.push(appendWithRead(blob ));
    }
    Promise.all(promises)
        .then(()=>{
            console.log("All set");
        })

}

//appendMessage();
asyncAppend()


setTimeout(()=>{
    console.log("script finished");
}, 10000)