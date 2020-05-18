import { IError as Err }  from "../../../../common/IError";
import { ChatUtility } from "./ChatUtility";

export class ClientSettings{
    constructor(version = Err.required(), nickname, pkfp){
        this.version = version
        this.membersData = {};
        this.invites = {};
        if (nickname){
            console.log(`Setting nickname for new settings: ${nickname}`);
            this.nickname = nickname
            this.membersData[pkfp] = {
                nickname: nickname
            }
        }
    }

    static encrypt(publicKey = Err.required, settings){

        if(typeof settings === "object"){
            settings = JSON.stringify(settings);
        }
        return ChatUtility.encryptStandardMessage(settings, publicKey);
    }

    setOwnerNickname(pkfp, nickname){
        this.setNickname(pkfp, nickname)
        this.nickname = nickname;
    }

    setNickname(pkfp, nickname){
        if(!this.membersData.hasOwnProperty(pkfp)){
            this.membersData[pkfp] = {};
        }
        this.membersData[pkfp].nickname = nickname;
    }
}


