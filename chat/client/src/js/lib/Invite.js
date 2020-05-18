import { iCrypto } from "./iCrypto"


export class Invite{

    static objectValid(obj){
        if (typeof(obj) === "string"){
            return false;
        }

        for (let i of Invite.properties){
            if (!obj.hasOwnProperty(i)){
                return false;
            }
        }
        return true;
    }

    static decryptInvite(cipher, privateKey, symLengthEncoding = 4){
        let ic = new iCrypto();
        let symlength = parseInt(cipher.substr(cipher.length - symLengthEncoding));
        let symkcip = cipher.substring(cipher.length-symlength - symLengthEncoding, cipher.length - symLengthEncoding);
        let payloadcip = cipher.substring(0, cipher.length - symlength - symLengthEncoding);
        ic.addBlob("symciphex", symkcip)
            .hexToBytes("symciphex", "symcip")
            .addBlob("plcip", payloadcip)
            .setRSAKey("privk", privateKey, "private")
            .privateKeyDecrypt("symcip", "privk", "sym")
            .AESDecrypt("plcip", "sym", "pl", true);
        return JSON.parse(ic.get("pl"));
    }

    static setInviteeName(invite, name){
        invite.inviteeName = name;
    }



    constructor(onionAddress = this.pRequired(),
                pubKeyFingerprint = this.pRequired(),
                hsPrivateKey){

        let ic = new iCrypto()
        ic.createNonce("n").bytesToHex("n", "id");
        this.set('onionAddress', onionAddress);
        this.set('pkfp', pubKeyFingerprint);
        this.set('inviteID', ic.get('id'));
        if (hsPrivateKey){
            let ic = new iCrypto();
            ic.setRSAKey("k", hsPrivateKey, "private")
            this.hsPrivateKey = ic.get("k");
        }
    }

    static constructFromExisting(invite){
        let ic = new iCrypto();
        ic.addBlob("i", invite.inviteCode)
            .base64Decode("i", "ir");

        let onion = ic.get("ir").split("/")[0];

        let newInvite = new Invite(onion, chat.session.publicKeyFingerprint, invite.hsPrivateKey);
        newInvite.set('inviteID', invite.inviteID);
        return newInvite;
    }




    toBlob(encoding){
        let result = this.get("onionAddress") + "/" +
            this.get("pkfp") + "/" +
            this.get("inviteID");
        if (encoding){
            let ic = new iCrypto();
            if (!ic.encoders.hasOwnProperty(encoding)){
                throw new Error("WRONG ENCODING");
            }
            ic.addBlob("b", result)
                .encode("b", encoding, "bencoded");
            result = ic.get("bencoded");
        }
        return result;
    }

    stringifyAndEncrypt(publicKey){
        if(!publicKey || !Invite.objectValid(this)){
            throw new Error("Error at stringifyAndEncrypt: the object is invalid or public key is not provided");
        }
        let ic = new iCrypto();

        let invite = {
            inviteCode: this.toBlob("base64"),
            hsPrivateKey: this.hsPrivateKey
        };

        if (this.inviteeName){
            invite.inviteeName = this.inviteeName
        }

        ic.addBlob("invite", JSON.stringify(invite))
            .sym.createKey("sym")
            .setRSAKey("pubk", publicKey, "public")
            .AESEncrypt("invite", "sym", "invitecip", true)
            .publicKeyEncrypt("sym", "pubk", "symcip", "hex")
            .encodeBlobLength("symcip", 4, "0", "symlength")
            .merge(["invitecip", "symcip", "symlength"], "res")
        return ic.get("res")

    }

    get  (name){
        if (this.keyExists(name))
            return this[name];
        throw new Error("Property not found");
    };

    set (name, value){
        if (!Invite.properties.includes(name)){
            throw 'Invite: invalid property "' + name + '"';
        }
        this[name] = value;
    };

    keyExists(key){
        if (!key)
            throw new Error("keyExists: Missing required arguments");
        return Object.keys(this).includes(key.toString());
    }

    pRequired(functionName = "Invite"){
        throw functionName + ": missing required parameter!"
    }
}

Invite.properties = ["onionAddress", "hsPrivateKey","pkfp", "inviteID"];

