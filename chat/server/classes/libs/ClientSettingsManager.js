const Err = require("./IError.js");

class ClientSettingsManager{
    constructor(historyManager){
        this.historyManager = historyManager;
    }

    getSettings(pkfp){
        return this.historyManager.getClientSettings(pkfp)
    }

    async writeSettings(pkfp, settings, metadata){
        await  this.historyManager.saveClientSettings(pkfp, settings);
    }
}


module.exports = ClientSettingsManager;