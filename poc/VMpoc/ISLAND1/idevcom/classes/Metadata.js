const Validator = require('./Validator');
const validator = new Validator();
const SETTINGS = require('../settings/settings');


class Metadata{
    constructor(ownerPublicKey, metadataString = undefined){

        if(typeof(ownerPublicKey) !== "string" || ownerPublicKey.length !== SETTINGS.publicKeyLength)
            throw "Error building metadata. Provided public key is invalid";

        this.owner = ownerPublicKey;
        this.date_created = new Date();
        this.users = {};
        this.invites = [];
    }

    add_user(user){
        if (!this.users.hasOwnProperty(user)){
            let newUser = new User();
            if (this.users.length === 0){
                newUser.setRights("11");
                this.owner = user;
            }
            this.users[user] = newUser;
        }
    }

    add_invite(invite){
        if (!this.invites.keys().hasOwnProperty(invite) && validator.is_valid_invite(invite)){
            this.invites.append(invite)
        }
    }


}

/**
 * implements user record in metadata
 * rights are:
 *    11 - owner
 *    01 - can invite
 *    00 - participant (default)
 *    type: string
 *
 */
class User{
    constructor(nickname = "Anonymous", rights = "00" ){
        this.nickname = nickname;
        this.rights = rights;
    }

    setRights(rights){
        this.rights=rights;
    }

    setNickname(nickname){
        nickname = nickname.trim();
        if(typeof(nickname)=== "string" && nickname.length>= 3)
            this.nickname = nickname;
    }

}

module.exports = Metadata;