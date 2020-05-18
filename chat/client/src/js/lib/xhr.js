import  * as CuteSet  from "cute-set";
import { log } from "util";

const REQUEST_TYPES = new CuteSet(["GET", "POST", "PUT", "DELETE"]);
const DATATYPES = new CuteSet(["json", "xml"]);
const CALLBACKTYPES = new CuteSet(["complete", "success", "error", "timeout"])


const AJAXTOXHR = {
    complete: "onloadend",
    success: "onload",
    error: "onerror",
    timeout: "ontimeout"
}

/**
 * This function meant to replace ubiquitous ajax
 * @param settings is an object with following xhr settings:
 *    (* settings are required)
 *
 *    type: default "GET". can be "GET", "POST", "PUT", "DELETE".
 *    *url: url string to which make request to
 *    dataType: default: "json". In Islands only json used, so this is the only option for now
 *    data: object with data to send to server
 *    success: callback to call if request succeed
 *    error: callback to call if request fails
 *    complete: callback to call after request completed. Will be called after success or error
 *   
 *
 */
export function XHR(settings){
    console.log("USING XHR AJAX REPLACEMENT!");
    let error = validateRequest(settings);
    if (error){
        throw error;
    }

    if (!settings.type || settings.type.toUpperCase() === "GET"){
        //GET request
        get(settings.url, settings);
    } else if (settings.type.toUpperCase() === "POST"){
        post(settings.url, settings);
    }
}


function validateRequest(settings){
    if (typeof settings !== "object"){
        return "Type of settings must be object";
    }

    if (!settings.url){
        return "URL is missing";
    }

    if (settings.type !== undefined){
        if (typeof settings.type !== "string"){

            return `Request type must be a string. Got ${typeof settings.type}`;
        }

        if (!REQUEST_TYPES.has(settings.type.toUpperCase())){
            return "Request type is invalid.";
        }
    }

    //Additional checks for POST request
    if(settings.type.toUpperCase() === "POST"){
        if(settings.dataType && !DATATYPES.has(settings.dataType)){
            return "Invalid data type";
        }
    }

}



function get(endpoint, settings){
    let _xhr = new XMLHttpRequest();
    _xhr.open("GET", endpoint);

    let keys = new CuteSet(Object.keys(settings));
    for (let cbtype of CALLBACKTYPES){
        console.log(`Checking if there is callback for ${cbtype}`)
        if (keys.has(cbtype) && (typeof settings[cbtype] === "function")){
            console.log("Setting handler for " + cbtype);
            _xhr[AJAXTOXHR[cbtype]] = callback(cbtype, _xhr, settings[cbtype])
        }
    }

    _xhr.send();

}


/**
 * This function meant to replace jquery ajax with bare xhr
 * @param endpoint a string containing the URL to which the request is sent
 * @param param is JSON object with following properties:
 *   accepts: string, default depends on dataType
 *   async: default true - makes request asynchronously
 *   beforeSend: function, called before request is sent
 *   cache: boolean
 *   complete: function, called after request is finished. Args: XMLHttprequest xhr, String textStatus
 *   data: Object, Array, or String - data to send to server
 *   error: function called if request fails. Args: XMLHttpRequest xhr, String textStatus, String errorThrown
 *   success: function called if request succeed. Args: Anything data, String textStatus, XMLHttpRequest xhr
 *   timeout: Number - set timeout in milliseconds
 *
 */


function post(endpoint, settings){


    let _xhr = new XMLHttpRequest();
    _xhr.open("POST", endpoint);

    //type of content passed to server
    let contentType = settings.contentType || 'application/json';

    //data type expected back
    _xhr.responseType = settings.dataType || 'json';

    //setting callbacks
    let keys = new CuteSet(Object.keys(settings));
    for (let cbtype of CALLBACKTYPES){
        console.log(`Checking if there is callback for ${cbtype}`)
        if (keys.has(cbtype) && (typeof settings[cbtype] === "function")){
            console.log("Setting handler for " + cbtype);
            _xhr[AJAXTOXHR[cbtype]] = callback(cbtype, _xhr, settings[cbtype])
        }
    }

    let data = settings.data;
    if (data){
        _xhr.setRequestHeader("Content-Type", contentType);
        if (typeof data === "object"){
            console.log("JSON processing data")
            data = JSON.stringify(settings.data);
        }
    }

    console.log("Sending POST request...");

    _xhr.send(data)

}



const callback = function (cbType, _xhr, handler){
    switch(cbType){
        case "complete": return ()=>{
            handler(processIncomingData(_xhr), _xhr.statusText, _xhr)
        }

        case "success": return ()=>{
            handler(processIncomingData(_xhr), _xhr.statusText, _xhr)
        }

        case "error": return ()=>{
            handler(_xhr.responseText);
        }

        case "beforeSend": throw new Error("Not Implemented");
        default: throw new Error("Unknown callback type");
    }
}



const processIncomingData = function(_xhr){
    try{
        console.log(`XHR RESPONSE: ${_xhr.response}`)
    }catch(err){}
    try{
        console.log(`XHR RESPONSE TEXT: ${_xhr.responseText}`);
    }catch(err){}

    switch (_xhr.responseType){
        case "json":
            try{
                return JSON.parse(_xhr.response);
            }catch(err){
                console.log("Unable to parse JSON.");
                return _xhr.response;
            }

        case "text":
        case "":
            try{
                return JSON.parse(_xhr.responseText);
            }catch(err){
                return _xhr.responseText;
            }
        default:
            console.log("No default processor found. Returning data as is.")
            return _xhr.response
    }
}

// ---------------------------------------------------------------------------------------------------------------------------
// Everything bellow is trash


function parseHeaders(headers){
    if(typeof headers !== "string"){
        throw new Error("Error: headers must be a string");
    }

    let hArr = headers.split("\n");
    res = {}
    hArr.forEach(header =>{
        let hSplit = header.split(/:\s*/)
        if (hSplit.length > 2){
            return;
        }
        res[hSplit[0]] = hSplit[1].split(/;\s*/)
    });
    return res
}
