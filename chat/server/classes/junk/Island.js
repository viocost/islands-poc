const MiddlewareManager = require('js-middleware').MiddlewareManager;

class RequestHandler{
    processRequest(name, num){
        console.log("processing request.. name: " + name  + " | num " + num);
        setTimeout(()=>{
            console.log("All set!");
        }, 2000)
    }
}


const verifyRequest = target => next => (...args)=>{
        console.log("Verifying request");


}


const r = new RequestHandler();
const mm = new MiddlewareManager(r);
mm.use("processRequest", verifyRequest);

r.processRequest("John", 15);

