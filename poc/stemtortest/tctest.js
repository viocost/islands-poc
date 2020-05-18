const TorControl = require('tor-control');




class TorController extends TorControl{
    constructor(opts){
        /**
         * Tor control class
         * @link https://gitweb.torproject.org/torspec.git/tree/control-spec.txt
         * @param {{}} [opts] - Options
         * @param {string} [opts.host="localhost"] - Host address to tor-control
         * @param {number} [opts.port=9051] - Port of tor-control
         * @param {string} [opts.password=""] - Host address to tor-control (default localhost)
         * @param {string} [opts.path] - Connect by path (alternative way to opts.host and opts.port)
         * @constructor
         */
        super(opts)
    }


    /**
     *
     * @param {object} params parameters that contain all options      *
     *  port Must be a string in format "PORT,HOST_IP:PORT"
     *      for example "80,127.0.0.1:5000"
     *  keyType
     *  keyContent
     *  discardKey
     *  detached
     *  basicAuth
     *  maxStreams
     *
     * @returns {Promise}
     */
    createHiddenService(params){
        return new Promise((resolve, reject)=>{
            let KEYTYPES = ["NEW", "RSA1024", "ED25519-V3"];
            let portPattern =/(6553[0-5]|655[0-2][0-9]\d|65[0-4](\d){2}|6[0-4](\d){3}|[1-5](\d){4}|[1-9](\d){0,3}),\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b(:(6553[0-5]|655[0-2][0-9]\d|65[0-4](\d){2}|6[0-4](\d){3}|[1-5](\d){4}|[1-9](\d){0,3}))?/;

            if(!params.hasOwnProperty("port")
                || !params.hasOwnProperty("keyType")
                || !KEYTYPES.includes(params.keyType)
                || !portPattern.test(params.port)
                || (params.keyType !== "NEW" && !params.hasOwnProperty("keyContent"))){
                reject("Invalid request.")
            }
            let request = "ADD_ONION ";

            if (params.keyType === "NEW")
                request += "NEW:RSA1024";
            else
                request += params.keyType +":" + params.keyContent + " ";

            let flags = [];

            if (params.hasOwnProperty("detached"))
                flags.push("detach");
            if (params.hasOwnProperty("discardKey"))
                flags.push("DiscardPK");
            if (params.hasOwnProperty('basicAuth'))
                flags.push("BasicAuth");

            let flagsString = flags.length ===0 ? "" : " Flags=" + flags[0];
            for (let i=1; i<flags.length; ++i){
                flagsString += ("," + flags[i])
            }
            request += flagsString;

            request += " port=" +params.port;

            console.log("Message: " + request);
          
           
        	this.sendCommand('SETEVENTS HS_DESC', (err, response)=>{
        		this.sendCommand(request, (err, response)=>{
   		   			if(err) reject(err);
   		   			resolve(response);
    			})

        	})
          	
   	    })
     
    }

    discardHiddenService(serviceID){
        return new Promise((resolve, reject)=>{
        	let idPattern = /^[a-z2-7]{16}(\.onion)?$/
        	serviceID = serviceID.trim(); 
        	serviceID = idPattern.test(serviceID) ? (serviceID.length === 16 ? serviceID : serviceID.substring(0, 16)) : reject("Invalid service ID");

        	let request = "DEL_ONION " + serviceID;
          
        	this.sendCommand(request, (err, response)=>{
            if(err)
                reject(err);
            resolve(response)
        	})
        })
    }


    listHiddenServices(detached = true){
    	return new Promise((resolve, reject)=>{

    		let request = "GETINFO " + (detached ? "onions/detached" : "onions/current");
         
        	this.sendCommand(request, (err, response)=>{
            if(err)
                reject(err);
            resolve(response)
        	})

   
    	})

    }



    setEvents(events){
		let request = "SETEVENTS ";
		if (typeof(events)!=="object"){			
			return this.sendCommandPromise(request + events)	
		} else {			
			for (let i=0; i<events.length; ++i){
				request += (events[i].trim() + " ")
			}
			return this.sendCommandPromise(request)
		}
    }

    removeAllEvents(){
		return this.sendCommandPromise("SETEVENTS")
    }


    sendCommandPromise(request, keepConnection){
    	return new Promise((resolve, reject)=>{
    		this.sendCommand(request, (err, response)=>{
    			if(err)
	                reject(err);
	            resolve(response)
    		}, keepConnection)
    	})
    }
}

let PKExisting = "MIICXQIBAAKBgQC7KNJ8GwV8MZTcTtVr8++zZ2itlu6oddfGANONZL8b5kRxrgaKtulYaINJkkLGOkIv2jsYvkRAivdNoMgeg8Ahnr+r7BmxES7C6Zc6vpRx43dXKqMzdkpD8MgqkS1+8fwqaiIXPztgrIJawZ3jN6Deo5yesX6AdCgSTFpsWjdknwIDAQABAoGAeewE+m4L67TM+Zutco7NlvyFd5f8Tue9sbI2HkUELiOacMfiYRj49+vVoubR8xpepZevqdXA1p7wrbRQyXggf2j5ojFSwqhmCU5mKp3DMWrKku/3QC3jCk0z1xi6eohBhFahi6OczNXIfnNSf77kX3mOibWbndSnGHp9tRU4+gkCQQDiElsDj7qVzxNHXSKYIfMFRbSGHK/pzzX2MZZaq+hngtylNR40yWaOGtUsWAWZDEyxfx4oEmlkSxTxSsJPldM1AkEA0++30rZxh/GgMlVJlxCcZNEdUVZwzzrsTVw6KDasupNri8UHpA5Hpb0nT3VTdNVaFzVRW2eYoma3xvILiSifAwJBAJtc//1nllQEFnyxzed9VVUnPVP5fQ+S3sPN+kVf5PzWGyrSYWrnijpYyG2MJHS01jQZZzEkzhcl3kOhG/6zuY0CQAWPGRw+ytWNAe2wDQEYX3HJhmJWyRi2a/JPg/sADCHMshp1bZDhCwIO5xQPeMPswLMxI9Qo8Hj6BsICIUlUtm8CQQCz+1i+2yBWMxxVb0V/yhML/URmBt7sNhkEB6cpwhFpI9j/3ViTRCoLOADLUff++ITEok5lTab7h/mHZpn/5kMC";



let a = new TorController({host:"localhost", port:"9051"})
existingParams = {port: "80,127.0.0.1:4003", keyType:"NEW", detached:true, discardKey:true, awaitPublication:true}
a.createHiddenService(existingParams)	
	.then(response =>{
		console.log("success creating existing")
		return a.setEvents(["HS_DESC", "HS_DESC_CONTENT"]);
	})
	.then(response =>{
		console.log("success listening events")
		console.log(JSON.stringify(response))
		return a.listHiddenServices();

	})	
	.then(response =>{
		console.log("success listing")
		return a.removeAllEvents();
	})
	.then(response =>{
		console.log("success removing")
		console.log(JSON.stringify(response))
	})

	.catch(err=>{
		console.log("fail: " + err);
})




