const CrossIslandDataTransporter = require("../libs/CrossIslandDataTransporter.js");
const FileUploader = require("../libs/FileUploader.js");
const FileDownloader = require("../libs/FileDownloader.js");
const Err = require("../libs/IError.js");

class DataTransferAssistant{
    constructor(connectionManager = Err.required(),
                historyManager = Err.required(),
                torConnector = Err.required()){
        this.registerConnectionManager(connectionManager);
        this.hm = historyManager;
        this.dataSockets = {};
        this.crossIslandDataTransporter = new CrossIslandDataTransporter(
            torConnector,
            historyManager
        );

    }

    registerConnectionManager(connectionManager){
        connectionManager.on("data_channel_opened", socket=>{
            let fileUploader = new FileUploader(socket, this.hm);
            let fileDownloader = new FileDownloader(socket, this.hm, this.crossIslandDataTransporter);
            this.dataSockets[socket.id] = {
                fileUploader: fileUploader,
                fileDownloader: fileDownloader
            };
        });

        connectionManager.on("data_channel_closed", socket=>{
            delete this.dataSockets[socket.id];
        });

        connectionManager.on("data_channel_reconnection", socket=>{

        })
    }
}

module.exports = DataTransferAssistant;