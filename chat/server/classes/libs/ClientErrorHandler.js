
class ClientErrorHandler{

    constructor(connectionManager){
        this.connectionManager = connectionManager;
    }

    returnCleintError(err, request, connectionId){
        this.connectionManager.send(this.getErrorIdentifier([request.headers.command]),
            err,
            connectionId)
    }

    getErrorIdentifier(command){
        return command + "_error";
    }

}


module.exports = ClientErrorHandler;