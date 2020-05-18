const mocha = require('mocha');
const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const iCrypto = require('../iCrypto');

describe("testing utilities", ()=>{

    beforeEach(()=>{
        this.ic = new iCrypto();
    });

    it("Should base64 encode", ()=>{
        let str = "ashdfkjsdjkfhkashk"
        this.ic.addBlob("a", str).base64Encode("a", "b");
        console.log(this.ic.get("b"));
        assert(this.ic.get("b") === "YXNoZGZranNkamtmaGthc2hr");
    });

    it("Should base64 decode", ()=>{
        this.ic.addBlob("a", "YXNoZGZranNkamtmaGthc2hr").base64Decode("a", "b");
        assert(this.ic.b === "ashdfkjsdjkfhkashk");

    });

    it("Should hash the passed string", ()=>{
       this.ic.addBlob("t1", "HelloWorld!").hash("t1", "h1", "SHA1", 0);
       assert(this.ic.get("h1") === "d735871a64133ee062400659cf91b8234d1c1930")
    });


    it("Should hash public key", ()=>{
        this.ic.generateRSAKeyPair("p1", 1024).getPublicKeyFingerprint("p1", "h1", true);
        assert(this.ic.get("h1"));
    });

    it("Should convert bytes to hex", ()=>{

    });

    it("Should convert bytes to hex", ()=>{

    });

});