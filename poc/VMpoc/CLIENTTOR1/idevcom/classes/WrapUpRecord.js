class WrapupRecord{

    constructor(record = ""){
        this.metadataS = "";
        this.metadataE = "";
        this.messageS = "";
        this.messageE = "";
        if(record !== ""){
            if(this.recordValid(record)){
                this.buildRecord(record);
            }else {
                throw "Wrapup record: Could not build record, passed string is invalid."
            }
        } else {
            this.metadataS = "000000000000";
            this.metadataE = "000000000000";
            this.messageS = "000000000000";
            this.messageE = "000000000000";
        }
    }

    /**
     * Returns wrapup record in string format, as it should be written in the file
     * Checks if the data is correct.
     * This method can be used externally.
     * @returns {string}  wrapup record or null if data is corrupted
     */
    getRecord(){
        if (this.objectValid())
            return this._getRecordAsString();
        else
            return null
    }

    /**
     *  returns all 4 pointers in string format
     *  as it will be written in history files
     *  No error checking.
     *  This method should not be called from outside,
     *  Use instead getRecord method
     * @returns {string}
     */
     _getRecordAsString(){
        return this.metadataS + this.metadataE + this.messageS + this.messageE;
    }

    /**
     *
     * @returns {*[]}
     *  returns all 4 pointers in list format. No error checking
     */
    getRecordAsList(){
        return [this.metadataS , this.metadataE , this.messageS , this.messageE]
    }

    buildRecord(record){
        this.metadataS = record.substring(0, 12);
        this.metadataE = record.substring(12, 24);
        this.messageS  = record.substring(24, 36);
        this.messageE  = record.substring(36, 48);
    }

    /**
     * Checks Whether passed string can be parsed as record
     * @param record {String}
     * @returns {boolean}
     */
    recordValid(record){
        return typeof(record) === "string" &&
                record.length  === 48 &&
                !isNaN(record);
    }

    /**
     * Checks whether passed string can be parsed as a valid pointer
     * @param pointer {string}
     * @returns {boolean}
     */
    pointerValid(pointer){
        return typeof (pointer) === "string" &&
            pointer.length === 12 &&
            !isNaN(pointer);
    }

    /**
     * Sets appropriate pointer
     * @param pointerType
     *  String, one of values: metadataS, metadataE, messageS, messageE
     * @param pointer
     *  String, valid pointer
     */
    setPointer(pointerType, pointer){
        if(this.pointerValid(pointer) && this.hasOwnProperty(pointerType)) {
            this[pointerType] = pointer;
            return true
        }
        return false;
    }

    /**
     * Returns list of 2 pointers
     * metadataStart and metadataEnd
     *
     */
    getLastMetadata(){
        return [this.metadataS, this.metadataE]
    }

    getLastMessage(){
        return[this.messageS, this.messageE]
    }

    /**
     * checks if all 4 pointers are valid pointers
     * and start pointers are less or equal to end pointers
     * @returns {boolean}
     */
    objectValid(){
        let valid = true;
        let pointers = this.getRecordAsList();
        pointers.forEach((pointer)=>{
            valid = valid && this.pointerValid(pointer)
        });

        let metadata = this.getLastMetadata();
        let message = this.getLastMessage();

        valid = valid && parseInt(metadata[0]) <= parseInt(metadata[1], 10) &&
            parseInt(message[0], 10) <= parseInt(message[1], 10);
        return valid;
    }
}

module.exports = WrapupRecord;