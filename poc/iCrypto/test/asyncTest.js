const mocha = require('mocha');
const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const iCrypto = require('../iCrypto');


describe('asyncTest', ()=>{
    beforeEach(()=>{
        this.ic = new iCrypto();
    });

   it("should add multiple plain texsts asyncronously", (done)=>{
        this.ic.asyncAddBlob("t1", "Hello patsak!")
            .then(ic =>{
                return ic.asyncAddBlob("t2", "Hello patsak2!")
            })
            .then(ic =>{
                return ic.asyncAddBlob("t3", "Hello patsak3!")
            })
            .then(ic =>{
                return ic.asyncAddBlob("t4", "Hello patsak4!")
            })
            // .then(ic=>{
            //     return ic.asyncAESEncrypt()
            // })
            .then(ic =>{
                assert(ic.get("t1") === "Hello patsak!" &&
                       ic.get("t4") === "Hello patsak4!")
                done();
            })
            .catch(err =>{
                console.log(err);
                assert(false);
                done();
            })


   });

   it("should create nonce async", (done)=>{
      this.ic.asyncCreateNonce("n1", 32)
          .then(ic => {
              assert(ic.get("n1").length === 32)
              done()
          })
          .catch(err => {
           console.log(err);
           assert(false);
           done()
       })

   });

    it("should create a key pair of a given length ASYNC", (done)=>{
        this.ic.asyncAddBlob("t1", "Hello patsak!")
            .then(ic =>{
                return ic.asyncGenerateRSAKeyPair("p1", 2048);
            })
            .then(ic =>{
                assert(ic.get("t1") === "Hello patsak!" &&
                ic.get("p1").publicKey &&
                ic.get("p1").length === 2048);
                done();
            })
            .catch(err =>{
                console.log(err);
                assert(false);
                done()
            })
    }).timeout(90000)

});