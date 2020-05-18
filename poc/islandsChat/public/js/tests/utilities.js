

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

    it("Should convert bytes to hex", ()=>{

    });

    it("Should convert bytes to hex", ()=>{

    });

});