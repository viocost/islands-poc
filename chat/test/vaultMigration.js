const HistoryManager = require("../server/classes/libs/HistoryManager");
const VaultManager = require("../server/classes/libs/VaultManager");
const { exportVault, importVault } = require("../server/classes/libs/VaultMigration");
const { assert, expect } = require("chai");
const mocha = require("mocha");
const fs = require("fs-extra")

describe("History export", ()=>{

    it('Should export the history', async ()=>{
        let historyPath = "some/path"
        let vaultsPath =  "some/path"
        let hm = new HistoryManager(historyPath);
        let vm = new VaultManager({vaultsPath: vaultsPath})
        let zip = await exportVault("510e6f07cbe714b82fa21a5d8243c46dc74d1b0811ff550c4e18cc5329445d9f", hm, vm)
        assert(fs.existsSync(zip));
    })

    it('Should import the vault', async ()=>{

        let pathToZip = "/home/kostia/vault.zip"
        let pathToHistory = "/home/kostia/sandbox/islands1/data/IslandsChat"
        await importVault(pathToZip, pathToHistory, true, "passwd");
        assert(1===1);
    }).timeout(20000)

})
