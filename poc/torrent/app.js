const Torrent = require("torrent-stream");


const link = "magnet:?xt=urn:btih:DAE494790830E97CC9E177943AB703FF7BCEDDB3&tr=http%3A%2F%2Fbt2.t-ru.org%2Fann%3Fmagnet&dn=%5BPS4%5D%20Puyo%20Puyo%20Tetris%20%5BEUR%2FENG%5D%20(v1.00)"

const engine = Torrent(link, {tmp: "./"} );

engine.on("ready", (res)=>{
    console.log("Done!: " + res)
});

engine.on("donwload", (i)=>{
    console.log("Downloaded chunk: " + i);
});


function wait(){
    setTimeout(wait, 10000)
}

wait();

