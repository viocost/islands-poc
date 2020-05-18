const Message = require("./Message.js");
const Err = require("../libs/IError.js");

class ServiceMessage extends Message{
    constructor(pkfpSource = Err.required(),
                pkfpDest = Err.required(),
                command = Err.required()){
        super();
        this.setHeader("pkfpSource", pkfpSource);
        this.setHeader("pkfpDest", pkfpDest);
        this.setHeader("command", command)
    }
}

module.exports = ServiceMessage;


