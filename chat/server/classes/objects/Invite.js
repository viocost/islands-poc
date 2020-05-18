const Err = require("../libs/IError.js");
const iCrypto = require("../libs/iCrypto.js");

class Invite{
    constructor(taResidence = Err.required("Missing TA Residence"),
                taPkfp = Err.required("Missing taPkfp"),
                inviteCode){
        this.residence = taResidence;
        this.pkfp = taPkfp;
        this.inviteCode = inviteCode ? inviteCode : iCrypto.createRandomHexString(32);
    }

    static parse(inviteString = Err.required()){
        const ic = new iCrypto();
        ic.addBlob("rs64", inviteString)
            .base64Decode("rs64", "rs");
        let parts = ic.get("rs").split("/");
        return new Invite(parts[0], parts[1], parts[2]);
    }

    toString(){
        const ic = new iCrypto();
        ic.addBlob("rs", this.getRawString())
            .encode("rs", "base64", "rshex");
        return ic.get("rshex");
    }

    getInviteCode(){
        return this.inviteCode;
    }

    getResidence(){
        return this.residence;
    }
    getPkfp(){
        return this.pkfp;
    }

    getRawString(){
        return this.getResidence() +  '/' + this.getPkfp() + "/" + this.getInviteCode();
    }


}


module.exports = Invite;
