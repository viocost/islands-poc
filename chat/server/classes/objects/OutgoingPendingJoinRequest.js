const Err = require("../libs/IError.js");


class OutgoingPendingJoinRequest{
    constructor(pkfp = Err.required(),
                inviteCode = Err.required(),
                publicKey = Err.required(),
                hsid = Err.required(),
                hsPrivateKey = Err.required(),
                connId = Err.required(),
                vaultRecord = Err.required(),
                vaultId = Err.required()){
        this.pkfp = pkfp;
        this.inviteCode = inviteCode;
        this.publicKey = publicKey;
        this.hsid = hsid.substring(0, 16) + ".onion";
        this.hsPrivateKey = hsPrivateKey;
        this.connId = connId;
        this.vaultId = vaultId;
        this.vaultRecord = vaultRecord;
    }
}

module.exports = OutgoingPendingJoinRequest;
