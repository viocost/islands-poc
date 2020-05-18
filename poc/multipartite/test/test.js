const mocha = require("mocha");
//const describe = mocha.describe;
//const it = mocha.it;
const assert = require("assert");


const Bimap = require("../lib/Bipartite.js");


describe("bimap", ()=>{
    it("should add 1 key and 2 values", () =>{
        let b = new Bimap();
        b.push("abcde.onion", "12345");
        b.push("abcde.onion", "54321");
        assert.equal(b.keySize(), 1 );
        assert.equal(b.valSize(), 2 )
    })

    it("should should delete all", () =>{
        let b = new Bimap();
        b.push("abcde.onion", "12345");
        b.push("abcde.onion", "54321");
        b.delKey("abcde.onion")
        assert.equal(b.keySize(), 0 );
        assert.equal(b.valSize(), 2 );
    })


    it("should should give 2 entries", () =>{
        let b = new Bimap();
        b.push("abcde.onion", "12345");
        b.push("abcde.onion", "54321");
        let r = b.key("abcde.onion");
        assert.equal(r[0], "12345" );
        assert.equal(r[1], "54321" );

        let r1 = b.val("54321");
        let r2 = b.val("12345");
        assert.equal(r1[0], "abcde.onion" );
        assert.equal(r2[0], "abcde.onion" );
        b.delVal("54321")

        let x = b.key("abcde.onion");
        assert.equal(x.length, 1 );
        assert.equal(x[0], "12345");
    })

    it("should return empty", () =>{
        let b = new Bimap();
        b.push("abcde.onion", "12345");
        b.push("abcde.onion", "54321");
        b.delKey("abcde.onion")

        console.log(b.key("blabal"))

        assert.equal(1,1 );

    })


})

