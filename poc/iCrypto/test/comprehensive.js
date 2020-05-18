const mocha = require('mocha');
const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const iCrypto = require('../iCrypto');


describe('Comprehensive test', ()=>{
    beforeEach(()=>{
        this.ic = new iCrypto();
    });

    it("Should convert pem to DER", ()=>{
        this.ic.generateRSAKeyPair("p1", 1024).getPublicKeyFingerprint("p1", "fp1", true);
        console.log(this.ic.get("fp1"));

    });


});
