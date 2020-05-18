export class IError{
    static required(msg){
        if(!msg){
            msg = "Missing required parameter"
        }
        throw new Error(msg)
    }
}

export function assert(cond, errMsg){
    if (!(cond)){
        let msg = errMsg ? `Assertion error: ${errMsg}` :  "Assertion error.";
        throw new Error(msg);
    }
}
