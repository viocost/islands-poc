let MiddlewareManager = require("js-middleware").MiddlewareManager;

class RequestHandler{

    constructor(checker){
        this.mm = new MiddlewareManager(this);
        this.mm.use("handleRequest", "handleRequest2", checker)
    }

    handleRequest(){
        console.log("Handling request");
        setTimeout(()=>{
            console.log("Done handling request");
        }, 2000)
    }

    handleRequest2(){
        console.log("Handling request");
        setTimeout(()=>{
            console.log("Done handling request");
        }, 2000)
    }

}


const requestVerifier = target => next => (...args) =>{
    console.log("Verifying request");
    setTimeout(()=>{
        console.log("verifyed");
        next(...args);
    }, 2000)
};


const r = new RequestHandler(requestVerifier);
// const mm = new MiddlewareManager(r);
// mm.use("handleRequest", requestVerifier);

r.handleRequest();
