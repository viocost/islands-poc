export class Participant{

    static objectValid(obj){
        if (typeof(obj) === "string"){
            return false;
        }

        for (let i = 0; i<Participant.properties.length;++i){
            if (!obj.hasOwnProperty(Participant.properties[i])){
                return false;
            }
        }
        return (Object.keys(obj).length === Participant.properties.length);
    }

    constructor(blob){
        if (blob){
            this.parseBlob(blob);
        }
    }

    toBlob(stringify = false){
        if (!this.readyForExport()){
            throw new Error("Object participant has some properties uninitialized");
        }
        let result = {};
        for (let i=0; i<Participant.properties.length; ++i){
            let key = Participant.properties[i];
            let value = this[Participant.properties[i]];
            console.log("Key: " + key + "; Value: " + value);
            result[Participant.properties[i]] = this[Participant.properties[i]];
        }
        return (stringify ? JSON.stringify(result) : result);
    }

    parseBlob(blob){
        if(!blob){
            throw new Error("missing required parameter");
        }

        if (typeof(blob)=== "string"){
            blob = JSON.parse(blob);
        }

        if (!this.objectValid(blob)){
            throw new Error("Participant blob is invalid");
        }

        for (let i = 0; i< Participant.properties.length; ++i){
            this[Participant.properties[i]] = blob[Participant.properties[i]]
        }

    }

    keyExists(key){
        if (!key)
            throw new Error("keyExists: Missing required arguments");
        return Object.keys(this).includes(key.toString());
    }



    readyForExport(){
        for (let i=0; i<Participant.properties; ++i){
            if (!this[Participant.properties[i]]){
                return false;
            }
        }
        return true;
    }

    get  (name){
        if (this.keyExists(name))
            return this[name];
        throw new Error("Property not found");
    };

    set (name, value){

        if (!Participant.properties.includes(name)){
            throw 'Participant: invalid property "' + name + '"';
        }

        this[name] = value;
    };

}

Participant.properties = ["nickname", "publicKey", "publicKeyFingerprint", "residence", "rights"];




