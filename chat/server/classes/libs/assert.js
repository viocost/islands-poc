function assert(cond, errMsg){
    if (!(cond)){
        let msg = errMsg ? `Assertion error: ${errMsg}` :  "Assertion error.";
        throw new Error(msg);
    }
}

module.exports = assert;
