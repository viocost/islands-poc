

describe("iCrypto main functionality", ()=>{

    beforeEach(()=>{
       this.icrypto = new iCrypto();
    });

    it("should set property in a class",()=>{
       this.icrypto.set("hello", "world");
       assert(this.icrypto.hello === "world");
    });

    it("should set property in a class",()=>{
        this.icrypto.set("hello", "world");
        assert(this.icrypto.get("hello") === "world");
    });

    it("Should throw error when trying to update locked object",()=>{
        this.icrypto.set("hello", "world");
        this.icrypto.lock();
        assert.throws(()=>{
            this.icrypto.set("hello", "world1");
        });

        assert.throws(()=>{
            this.icrypto.set("hello123", "world1");
        });

    });

    it("should lock and unlock object and finally add new property",()=>{
        this.icrypto.set("hello", "world");
        this.icrypto.lock();
        this.icrypto.unlock();
        this.icrypto.set("hello1", "free world!");
        assert(this.icrypto.hello1 === "free world!")
    });



    it("Should add plain text to icrypto object", ()=>{
        this.icrypto.addBlob("text", "hello world");
        assert(this.icrypto.text === "hello world");
    });

    it("Should convert to string and add plain text to icrypto object", ()=>{
        this.icrypto.addBlob("text", 6543456);
        assert(this.icrypto.text === "6543456");
    });

    it("Should raise no argument exception", ()=>{
        assert.throws(()=>{
            this.icrypto.addBlob()
        });
    })










});


describe("iCrypto keys finding functions", ()=>{

    beforeEach(()=>{
        this.icrypto = new iCrypto();
        this.icrypto.addBlob("a", "hello a");
        this.icrypto.addBlob("b", "hello b");
        this.icrypto.addBlob("c", "hello c");
        this.icrypto.addBlob("d", "hello d");
        this.icrypto.addBlob(1, "hello 1");
        this.icrypto.addBlob(5, "hello 5");
    });


    it("should return true: keys are  found", ()=>{
        expect(this.icrypto.keysExist(["a", "b"])).to.be.true;
    });

    it("should return true: keys are  found", ()=>{
        expect(this.icrypto.keysExist(["a"])).to.be.true;
    });

    it("should return true: keys are  found", ()=>{
        expect(this.icrypto.keysExist(["a"])).to.be.true;
    });

    it("should throw an error", ()=>{
        expect(() => {
            this.icrypto.keysExist();
        }).to.throw("keysExist: Missing required arguments");
    });

    it("should return false: keys are not found", ()=>{
        expect(this.icrypto.keysExist(["f", "gf"])).to.be.false;
    });

    it("should return false: keys are not found", ()=>{
        expect(this.icrypto.keysExist(["a", "gf"])).to.be.false;
    });


    it("should return true: keys should be found", ()=>{
        expect(this.icrypto.keysExist([1, 5])).to.be.true;
    });
    it("should return true: keys should be found", ()=>{
        expect(this.icrypto.keysExist("a")).to.be.true;
    });

    it("should return true: keys should be found", ()=>{
        expect(this.icrypto.keysExist(1)).to.be.true;
    });


    it("should return flase: keys should not be found", ()=>{
        expect(this.icrypto.keysExist([4, 5])).to.be.false;
    });

});

describe("Merge functionality",()=>{

    beforeEach(()=>{
        this.icrypto = new iCrypto();
        this.icrypto.addBlob("a", "qwer");
        this.icrypto.addBlob("b", "rewq");
        this.icrypto.createSYMKey("key")

    });

    it("Should merge 2 objects", ()=>{
        assert(this.icrypto.merge(["a", "b"], "merged").merged === "qwerrewq")
    });

    it("Should throw cannot merge arrays", ()=>{
        expect(()=>{
            this.icrypto.merge(["a", "b", "key"], "merged");
        }).to.throw();
    })

});