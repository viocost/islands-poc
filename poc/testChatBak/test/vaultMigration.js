const HistoryManager = require("../classes/libs/HistoryManager");
const VaultManager = require("../classes/libs/VaultManager");
const { exportVault } = require("../classes/libs/VaultMigration");
const { assert, expect } = require("chai");
const mocha = require("mocha");

describe("History export", ()=>{

    it('Should export the history', ()=>{
        let historyPath = "~/sandbox/islands/data/IslandsChat/history"
        let vaultsPath = "~/sandbox/islands/data/IslandsChat/vaults"
        let hm = new HistoryManager(historyPath);
        let vm = new VaultManager({vaultsPath: vaultsPath})
        let zip = exportVault("510e6f07cbe714b82fa21a5d8243c46dc74d1b0811ff550c4e18cc5329445d9f")
        assert(zip instanceof Buffer);
    })

})
