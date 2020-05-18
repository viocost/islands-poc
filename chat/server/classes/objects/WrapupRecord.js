/**
 * TODO Desc here
 */
class WrapupRecord{
    constructor(blob, length = 16){

        blob = blob ? blob : this.getStringOfZeroes(64);

        if(blob.length !== 64)
            throw new Error("Wrapup record length is invalid");

        this.lastMetadataStart = parseInt(blob.substring(0, 16));
        this.lastMetadataEnd = parseInt(blob.substring(16, 32));
        this.lastMessageStart = parseInt(blob.substring(32, 48));
        this.lastMessageEnd = parseInt(blob.substring(48, 64));

    }

    update(metaStart, metaEnd, messageStart, messageEnd){
        let a = [this.lastMetadataStart,
            this.lastMetadataEnd,
            this.lastMessageStart,
            this.lastMessageEnd];

        let b = [metaStart, metaEnd, messageStart, messageEnd];

        for (let i = 0; i<4; ++i){
            a[i] = b[i] ? b[i]: a[i];
        }
    }

    setLastMetadata(metaStart, metaEnd){
        metaStart = parseInt(metaStart);
        metaEnd = parseInt(metaEnd);
        if (metaStart > metaEnd)
            throw new Error("Start position cannot be after end position");
        this.lastMetadataStart =  metaStart;
        this.lastMetadataEnd = metaEnd;
    }

    setLastMessage(messageStart, messageEnd){
        messageStart = parseInt(messageStart);
        messageEnd = parseInt(messageEnd);
        if (messageStart > messageEnd)
            throw new Error("Start position cannot be after end position");
        this.lastMessageStart =  messageStart;
        this.lastMessageEnd = messageEnd;
    }

    getLastMessageSize(){
        return this.lastMessageEnd - this.lastMessageStart;
    }

    getLastMetadataSize(){
        //console.log("lastMetadataStart: " + this.lastMetadataStart + " lastMetadataEnd: " + this.lastMetadataEnd);
        return this.lastMetadataEnd - this.lastMetadataStart;
    }


    toBlob(){
        this.checkErrors();
        let result = "";
        let a = [this.lastMetadataStart,
            this.lastMetadataEnd,
            this.lastMessageStart,
            this.lastMessageEnd]

        for (let i=0; i<4; ++i){
            let v = a[i].toString();
            result += this.getStringOfZeroes(16 - v.length) + v
        }

        if (result.length !== 64) throw new Error("Error forming wrapup record: final length is not 64");

        return result;
    }

    checkErrors(){
        if(this.lastMetadataEnd < this.lastMetadataStart ||
            this.lastMessageEnd < this.lastMessageStart) throw new Error("Wrapup record is invalid");
    }

    getStringOfZeroes(length){
        return "0".repeat(length);
    }
}


module.exports = WrapupRecord;
