const server = require('../app');
const chai = require('chai');
const mocha = require('mocha');
const assert = require('assert');
const persistence = require('../controllers/persistence');
const Wrapup = require('../classes/WrapUpRecord');


describe("Wrapup record", ()=> {

    it("Should parse passed string and build a wrappingup object", (done) => {
        let wrapup = new Wrapup('111111111111222222222222333333333333444444444444');
        let wrapupString = wrapup.getRecord();
        console.log(wrapupString);
        assert(wrapupString === '111111111111222222222222333333333333444444444444');
        done()
    });

    it("Should get last metadata pointer", (done) => {
        let wrapup = new Wrapup('111111111111222222222222333333333333444444444444');
        let metadata = wrapup.getLastMetadata();
        assert(metadata[0] === '111111111111' && metadata[1] === '222222222222')
        done()
    });

    it("Should get last message pointer", (done) => {
        let wrapup = new Wrapup('111111111111222222222222333333333333444444444444');
        let message = wrapup.getLastMessage();
        assert(message[0] === '333333333333' && message[1] === '444444444444');
        done()
    });

    it("Should create a clean wrapup object", (done) => {
        let wrapup = new Wrapup();
        let wrapupString = wrapup.getRecord();
        console.log(wrapupString);
        assert(wrapupString === '000000000000000000000000000000000000000000000000');
        done()
    });

    it("parsing should fail if string is not 48 chars long ", (done) => {
        assert.throws(() => {
            new Wrapup('1234');
        });
        done()

    });

    it("should fail if string contains anything other than numbers", (done) => {
        assert.throws(() => {
            new Wrapup('fdsag323455');
        });
        done()
    });

});

describe("Metadata record", ()=>{

});

describe ("Message record", ()=>{

});

/**
              .,-:;//;:=,
          . :H@@@MM@M#H/.,+%;,
       ,/X+ +M@@M@MM%=,-%HMMM@X/,
     -+@MM; $M@@MH+-,;XMMMM@MMMM@+-
    ;@M@@M- XM@X;. -+XXXXXHHH@M@M#@/.
  ,%MM@@MH ,@%=             .---=-=:=,.
  =@#@@@MX.,                -%HX$$%%%:;
 =-./@M@M$                   .;@MMMM@MM:
 X@/ -$MM/                    . +MM@@@M$
,@M@H: :@:                    . =X#@@@@-
,@@@MMX, .                    /H- ;@M@M=
.H@@@@M@+,                    %MM+..%#$.
 /MMMM@MMH/.                  XM@MH; =;
  /%+%$XHH@$=              , .H@@@@MX,
   .=--------.           -%H.,@@@@@MX,
   .%MM@@@HHHXX$$$%+- .:$MMX =M@@MM%.
     =XMMM@MM@MM#H;,-+HMM@M+ /MMMX=
       =%@M@M#@$-.=$@MM@@@M; %M%=
         ,:+$+-,/H#MMMMMMM@= =,
               =++%%%%+/:-.
*/