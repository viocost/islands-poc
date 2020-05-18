class IError{
    static required(msg){
        if(!msg){
            msg = "Missing required parameter"
        }
        throw new Error(msg)
    }
}


module.exports = IError;