const fs = require("fs");
const WrapupRecord = require("../objects/WrapupRecord.js");


class HistoryIndexFixer{
    constructor(fullPath, historyFileName){
        this.path = this.processFullPath(fullPath);
        this.historyFileName = historyFileName;
        this.tempHistoryName = "history_store_temp";
        this.openHistoryFile()

    }

    async fixHistory(){
        let self = this;
        let damagedRecords = [];
        let tempFile = self.createTempFile(self.path);
        let currLength = 0;
        let chunk;
        let remainder = "";
        let curWrup = new WrapupRecord();
        while(1){
            let data = await self.readChunk();
            self.historyOffset += data[0];
            if(data[0] === 0){
                //All set
                return;
            }
            chunk = data[1]

            let records = chunk.split(/\d{64}/);
            for(let i=0; i<records.length; ++i){
                let record;
                if(i === 0){
                    record = remainder + records[i];
                    remainder = ""
                } else{
                    record = records[i];
                }

                let rLength = record.length;

                if(!self.isRecordValid(record) && i < records.length-1){
                    damagedRecords.push(record);
                    continue
                } else if(i === records.length-1){
                    remainder = record;
                    continue
                }

                if(self.isMetadata(record)){
                    curWrup.lastMetadataStart = currLength
                    curWrup.lastMetadataEnd = currLength + rLength;
                } else{
                    curWrup.lastMessageStart = currLength
                    curWrup.lastMessageEnd = currLength + rLength;
                }
                let blob = record + curWrup.toBlob();

                await self.appendBlob(tempFile, blob);

                currLength += blob.length
            }

        }
    }

    async finalize(){
        fs.unlinkSync(this.path + this.historyFileName)
        fs.renameSync(this.path + this.tempHistoryName, this.path + this.historyFileName)
    }

    isMetadata(record){
        return /{"body":{"participants":/.test(record)
    }

    openHistoryFile(){
        this.historyOffset = 0;
        this.historyFile = fs.openSync(this.path + this.historyFileName, "r")
    }


    readChunk(){
        return new Promise((resolve, reject)=>{
            let buffer = Buffer.from(new Uint8Array(1048576));
            fs.read(this.historyFile, buffer, 0, 1048576, this.historyOffset, (err, bytesRead, buffer)=>{
                if(err){
                    reject(err);
                }
                resolve([bytesRead, buffer.toString()])
            })
        })

    }


    appendBlob(tempFile, blob){
        return new Promise((resolve, reject)=>{
            fs.appendFile(tempFile, blob, (err)=>{
                if (err) {
                    reject(err);
                } else{
                    resolve();
                }
            });
        });


        // fs.appendFile(fd, 'data to append', 'utf8', (err) => {
        //     fs.close(fd, (err) => {
        //         if (err) throw err;
        //     });
        //     if (err) throw err;
        // });
    }


    processFullPath(path){
        return path[-1] === "/" ? path : path + "/"
    }

    createTempFile(){
        if(!fs.existsSync(this.path)){
            throw new Error("Path is invalid");
        }
        return fs.openSync(this.path+ this.tempHistoryName, "a");
    }


    isRecordValid(record){
        try{
            JSON.parse(record)
            return true
        }catch(e){
            return false
        }
    }
}



module.exports = HistoryIndexFixer;
