

describe("AES tests", ()=>{
    beforeEach(()=>{
        this.ic = new iCrypto();
    });

    it("Should create AES key", ()=>{
        this.ic.createSYMKey("key");
        assert(this.ic.key.iv.length === 32 && this.ic.key.key.length === 32)
    });

    it("Shouild fail as name already occupied", ()=>{
        assert.throws(()=>{
            this.ic.addBlob("a", "abcde").createSYMKey("a")
        });
    });


    it("Should encrypt plain text", ()=>{
       this.ic.createSYMKey("key").addBlob("text", "HelloWorld").AESEncrypt("text", "key", "cipher");
        assert(this.ic.cipher);
    });

    it("perform round of encryption and decryption", ()=>{
        this.ic.createSYMKey("key")
            .addBlob("text", "HelloWorld")
            .AESEncrypt("text", "key", "cipher")
            .AESDecrypt("cipher", "key", "decryptedText");
        console.log(this.ic.decryptedText.toString());
        assert(this.ic.decryptedText === "HelloWorld");
    });


});