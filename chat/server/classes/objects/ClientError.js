const Err = require("../libs/IError.js");
const Message = require("./Message.js");

class ClientError extends Message{
    constructor(request = Err.required(),
                errType = Err.required(),
                errData = Err.required()){
        super();
        this.headers = request.headers;
        this.body = request.body;
        this.signature = request.signature;
        this.setResponse(errType);
        this.setError(errData);
    }


    setError(errMsg){
        this.headers.error = errMsg;
    }

    setResponse(errType){
        this.headers.response = errType;
    }
}


module.exports = ClientError;