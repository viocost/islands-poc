const Err = require("../libs/IError.js");

/**
 *  Any request that leaves an island, meaning going island-to-island must be wrapped in CrossIslandEnvelope
 *
 *  The envelope has following fields:
 *      - origin  - onion address of the sender's island
 *      - destination  onion address of the recipient's island
 *      - payload
 *      - return  - flag whether it is return envelope
 *      - error (Optional) - error message
 *
 *  Normally only origin, destination and payload fields must be set.
 *
 *  If error happens during the processing request stage on the recipient's island
 *  the envelope is returned back to the sender's island.
 *  In that case return is set to true and error message is added to the envelope.
 *
 */
class CrossIslandEnvelope{
    constructor(destination = Err.required(),
                payload = Err.required(),
                origin){
        this.destination = destination;
        this.payload = payload;
        this.origin = origin;
        this.returnOnConnectionFail = false;
    }

    static getOriginalPayload(envelope){
        let request = envelope;
        while(request.payload){
            request = request.payload;
        }
        return request;
    }

    setReturn(err){
        this.return = true;
        this.error  = err;
    }

    setResponse(){
        this.response = true;
    }

    setReturnOnFail(val){
        this.returnOnConnectionFail = !!val;
    }

    /**
    * Given original envelope swaps origin and destination 
    * and sets return flag and error message
    * 
    */
    static makeReturnEnvelope(originalEnvelope, err){
        const returnEnvelope = new CrossIslandEnvelope(originalEnvelope.origin, originalEnvelope, originalEnvelope.destination);
        returnEnvelope.setReturn(err);
        return returnEnvelope;
    }

    getPayload(){
        return this.payload;
    }

    setPayload(payload = Err.required()){
        this.payload = payload;
    }
}

module.exports = CrossIslandEnvelope;
