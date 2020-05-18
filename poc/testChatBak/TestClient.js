const io = require("socket.io-client");
const http = require("http");
/**
 * This class is made to test islands server
 * Since Islands code runs in isolation, it doesn't test it directly.
 * It pretends to be a fake client, sends commands and tests the outcome.
 *
 */
class TestClient{
    constructor(opts){
        this.islands = opts.islands;
    }

    getVault(){
        return new Promise((resolve, reject)=>{
            http.get({
                hostname: 'localhost',
                port: 4000,
                path: "/",
            },
            (res)=>{
                console.log(`Resolving res: ${res.statusCode}`)
                resolve(res.statusCode);
            })
        })
    }


    establishConnection(){
        const socketConfig = {
            query: {
                vaultId: undefined
            },
            reconnection: false,
            forceNew: true,
            autoConnect: false,
            pingInterval: 10000,
            pingTimeout: 5000,
            upgrade: upgrade
        }


        let socket = io('localhost:4000/chat', socketConfig);


    }

}

module.exports = TestClient
