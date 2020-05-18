const { exec } = require('child_process');

var cmds = ['echo 1', 'echo 2', 'echo 3'];

const promiseSerial = cmds =>
    cmds.reduce((promise, cmd) =>
            promise.then(result =>
                cmd().then(Array.prototype.concat.bind(result))),
        Promise.resolve([]));


const funcs = cmds.map(cmd => () => execCommand(cmd));



function execCommand(command){
    return new Promise((resolve, reject)=>{
        exec(command, (error, stdout, stderr)=>{
            console.log(stdout.toString());
            resolve();
        })
    })
}

// execute Promises in serial


promiseSerial(funcs)
    .then(console.log.bind(console))
    .catch(console.error.bind(console));



