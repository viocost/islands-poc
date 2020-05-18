const mocha = require('mocha');
const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const iCrypto = require('../iCrypto');

describe("testing utilities", ()=> {

    beforeEach(() => {
        this.ic = new iCrypto();
    });

    it("should generate RSA key pair", ()=>{
        this.ic.generateRSAKeyPair("pair");
        assert(this.ic.get("pair").publicKey &&
            this.ic.get("pair").privateKey)
    }).timeout(7000);

    it("should generate RSA key pair of a given size", ()=>{
        this.ic.generateRSAKeyPair("pair", 512);
        assert(this.ic.get("pair").publicKey &&
            this.ic.get("pair").privateKey &&
            this.ic.get("pair").length === 512)
    }).timeout(7000);

    it("should encrypt string with public key. All the objects should be present", ()=>{
        this.ic.addBlob("t1", "Hello world")
            .generateRSAKeyPair("p1", 1024)
            .publicKeyEncrypt("t1", "p1", "c1");

        assert(this.ic.c1 && this.ic.p1 && this.ic.t1);
    }).timeout(7000);

    it("Shoud encrypt with public and decrypt with private a string",()=>{
        this.ic.addBlob("t1", "Hello world")
            .generateRSAKeyPair("p1", 1024)
            .publicKeyEncrypt("t1", "p1", "c1")
            .privateKeyDecrypt("c1", "p1", "res");
        assert(this.ic.res === "Hello world");
    }).timeout(7000);

    it("Shoud encrypt with private and decrypt with public a string",()=>{

        this.ic.addBlob("t1", "Hello world")
            .generateRSAKeyPair("p1", 1024)
            .privateKeySign("t1", "p1", "c1")
            .publicKeyVerify("t1", "c1", "p1", "res");
        assert(this.ic.res === true);
    }).timeout(7000);


    /*
    it("should encrypt string with private key. All the objects should be present", ()=>{
        return; ///need to discuss this
        this.ic.addBlob("t1", "Hello world")
            .generateRSAKeyPair("p1", 1024)
            .privateKeyEncrypt("t1", "p1", "c1");

        assert(this.ic.c1 && this.ic.p1 && this.ic.t1);
    }).timeout(7000);

    it("Shoud encrypt with private and decrypt with public a string",()=>{
        return; //need to discuss
        this.ic.addBlob("t1", "Hello world")
            .generateRSAKeyPair("p1")
            .privateKeyEncrypt("t1", "p1", "c1")
            .publicKeyDecrypt("c1", "p1", "res");
        assert(this.ic.res === "Hello world");
    }).timeout(7000);
    */





});