const mocha = require('mocha');
const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const iCrypto = require('../iCrypto');


describe("Nonces functionality", ()=>{

    beforeEach(()=>{
        this.ic = new iCrypto();
    });

    it("Should create a nounce of a given size", ()=>{
        this.ic.createNonce("nonce");
        assert(this.ic.get("nonce") && this.ic.get("nonce").length ===32);
    });

    it("Should create a nounce of a given size", ()=>{
        this.ic.createNonce("nonce", 16);
        assert(this.ic.get("nonce") && this.ic.get("nonce").length ===16);
    });
});