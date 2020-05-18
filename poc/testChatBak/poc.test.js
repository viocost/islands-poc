const io = require("socket.io-client");
const http = require("http");
const fs = require("fs-extra");
const path = require("path")
const chai = require("chai");
const assert = chai.assert;
const expect = chai.expect;
const should = chai.should;

const iCrypto = require("../server/classes/libs/iCrypto");
const Vault = require("./MockVault.js");

const Client = require("./TestClient.js");
let config;

describe("Connection test", function(){
    this.timeout(10000);
    before(async ()=>{
        // 1. Load data dirs and clear them

        config = JSON.parse(fs.readFileSync("./test/config.json"));
        for(let island of config){
            await fs.emptyDir(path.join(island.data, "history"))
            await fs.emptyDir(path.join(island.data, "hs"))
            await fs.emptyDir(path.join(island.data, "hsmap"))
            await fs.emptyDir(path.join(island.data, "keys"))
            await fs.emptyDir(path.join(island.data, "service"))
            await fs.emptyDir(path.join(island.data, "vaults"))
        }

        console.log("Prepared for testing...")

    })

    //Testing scenario
    //
    // 2. Check connection
    // 3. Register admin vault
    // 4. Vault Login
    // 5. Init session
    // 6. Create topic
    // 7. Create invite
    //

    it("Testing http connection with the island", async ()=>{
        let client = new Client({});
        let code = await client.getVault();
        expect(code).to.equal(200);
    })

    it("Testing socket connection", (done)=>{
        let socket = io('ws://localhost:4000/chat', {
            autoConnect: false,
            upgrade: true,
            reconnection: false
        })

        socket.on("connect", ()=>{
            console.log("Connection established");
            assert.equal(socket.connected, true);
            socket.disconnect();
            done();
        })
        socket.open();

    })

    it("Testing new vault registration", ()=>{

        return new Promise((resolve, reject) => {

            let password = "KarlUKlaryUkralKoral"
            let ic = new iCrypto();
            ic.generateRSAKeyPair("adminkp")
                .createNonce("n")
                .privateKeySign("n", "adminkp", "sign")
                .bytesToHex("n", "nhex");


            let vault = new Vault();
            vault.initAdmin(password, ic.get("adminkp").privateKey, "2.0.0");


            let vaultEncData = vault.pack();
            let vaultPublicKey = vault.publicKey;
            let adminPublicKey = ic.get("adminkp").publicKey;

            let data = JSON.stringify({                                                               //
                action: "admin_setup",                                            //
                adminPublickKey: adminPublicKey,                                  //
                hash: vaultEncData.hash,                                          //
                nonce: ic.get('nhex'),                                            //
                sign: ic.get("sign"),                                             //
                vault: vaultEncData.vault,                                        //
                vaultPublicKey: vaultPublicKey,                                   //
                vaultSign: vaultEncData.sign                                      //
            });                                                                    //

            let req = http.request({
                method: "POST",
                hostname: `${config[0].address}`,
                port: config[0].port,
                path: "/admin",
                headers: {
                    'Content-Type': "application/json",
                    'Content-Length': data.length
                }

            }, (res)=>{
                assert.equal(res.statusCode, 200);
                resolve()

            })

            req.write(data);

            console.log(`sending register request. Hash: ${vaultEncData.hash}`);

        })
        //
        //////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////
        // XHR({                                                                     //
        //     type: "POST",                                                         //
        //     url: "/admin",                                                        //
        //     dataType: "json",                                                     //
        //     data: {                                                               //
        //         action: "admin_setup",                                            //
        //         adminPublickKey: adminPublicKey,                                  //
        //         hash: vaultEncData.hash,                                          //
        //         nonce: ic.get('nhex'),                                            //
        //         sign: ic.get("sign"),                                             //
        //         vault: vaultEncData.vault,                                        //
        //         vaultPublicKey: vaultPublicKey,                                   //
        //         vaultSign: vaultEncData.sign                                      //
        //     },                                                                    //
        //     success: () => {                                                      //
        //         console.log("Success admin register");                            //
        //         loadingOff();                                                     //
        //         adminSession = {                                                  //
        //             publicKey: ic.get('adminkp').publicKey,                       //
        //             privateKey: ic.get('adminkp').privateKey                      //
        //         };                                                                //
        //         util.$("#setup--wrapper").style.display = "none";                 //
        //         util.$("#registration-complete--wrapper").style.display = "flex"; //
        //                                                                           //
        //                                                                           //
        //         util.removeClass('#island-setup', 'btn-loading');                 //
        //         resolve();                                                        //
        //     },                                                                    //
        //     error: err => {                                                       //
        //         loadingOff();                                                     //
        //         console.log(err.message);                                         //
        //         reject("Fail!" + err);                                            //
        //         util.removeClass('#island-setup', 'btn-loading');                 //
        //     }                                                                     //
        // });                                                                       //
        ///////////////////////////////////////////////////////////////////////////////
    })

})

