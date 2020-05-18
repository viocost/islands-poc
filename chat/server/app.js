const express = require('express');
const app = express();
const Chat = require('./classes/IslandsChat');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require("fs-extra");
const fileUpload = require('express-fileupload');
//const HiddenServiceManager = require("./classes/libs/HiddenServiceManager");

const Logger = require("./classes/libs/Logger.js");
//const helpRouter = require("./helpRouter.js");
//const vaultRouter = require("./vaultRouter");
const adminRouter = require("./adminRouter");
const appRouter = require("./appRouter");
const HSVaultMap = require("./classes/libs/HSVaultMap");
//const mobileRouter = require("./mobileRouter");

console.log("\n\nINITIALIZING ISLANDS....")

try{
    global.VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "../",'package.json' )).toString()).version;

    console.log(`Version is set to ${global.VERSION}`)
}catch(err){
    console.trace("Failed to set version: " + err );
    global.VERSION = "version unknown";
}

app.use(fileUpload());


let PORT = 4000;
let HOST = '0.0.0.0';

global.DEBUG = false;


let configPath = path.join(__dirname, 'config', 'config.json');
let historyPath = "../history/";
let adminKeysPath = "../keys/";
let servicePath = "../service/";
let logger;

process.argv.forEach((val, index, array)=>{
    switch(val){
        case "-p":
            PORT = process.argv[index+1];
            break;
        case "-h":
            HOST = process.argv[index+1];
            break;
        case "-k":
            adminKeysPath = process.argv[index+1];
            break
        case "--debug":
            console.log("Setting global debug to true");
            global.DEBUG = true;
            break
    }
});


let configFile = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function verifyGetConfigParameter(param, configFile){
    if(process.env[param]){
        return process.env[param]
    } else if (!global.DEBUG || !configFile[param]){
        console.error(`Required parameter ${param} has not been provided. Note that production mode requires paramters to be passed via environment variables. \nExiting...`)
        process.exit(1)
    } else {
        return configFile[param]
    }
}

//Building configuration
const basePath = path.join(verifyGetConfigParameter("ISLANDS_DATA"), "IslandsChat");
const torPassword = verifyGetConfigParameter("TOR_PASSWD", configFile);
const torControlPort = verifyGetConfigParameter("TOR_CONTROL_PORT", configFile);
const torControlHost = verifyGetConfigParameter("TOR_CONTROL_HOST", configFile);
const torHost = verifyGetConfigParameter("TOR_HOST", configFile);
const torPort = verifyGetConfigParameter("TOR_PORT", configFile);
const torSOCKSPort = verifyGetConfigParameter("TOR_SOCKS_PORT", configFile);

const config = {
    "historyPath":        path.join(basePath, "history"),
    "updatePath":         path.join(basePath, "update"),
    "adminKeyPath":       path.join(basePath, "keys"),
    "vaultsPath":         path.join(basePath, "vaults"),
    "servicePath":        path.join(basePath, "service"),
    "hsVaultMap":         path.join(basePath, "hsmap"),
    "hiddenServicesPath": path.join(basePath, "hs"),
    "basePath":           basePath,
    "vaultIdLength":      64,
    "torConnector": {
        "hiddenServiceHOST": torHost,
        "hiddenServicePORT": torPort,
        "torListenerPort": 80,
        "torControlHost": torControlHost,
        "torControlPort": torControlPort,
        "torControlPassword" : torPassword,
        "torSOCKSPort": torSOCKSPort
    }
}

if(!fs.existsSync(basePath)){
    try{
        fs.mkdirSync(basePath)
    }catch (err){
        console.log(`Unable to create base directory: ${err}`)
        console.log("Exiting...");
        process.exit
    }
}

Logger.initLogger(config.servicePath, "debug");
let helloMsg = "!!=====ISLANDS v." + global.VERSION + " =====!!"
console.log(helloMsg);
Logger.info(helloMsg);

historyPath = config.historyPath || historyPath;
let updatePath = config.updatePath || "../update";

let adminKeyPath = config.adminKeyPath || "../keys";

servicePath = config.servicePath || "../service/";

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', parameterLimit: 100000}));

if (app.get('env') === 'development'){
    logger = require('morgan');
    app.use(logger('dev'));
    app.locals.pretty = true;
}

app.use(express.static(path.join(__dirname, '../public')));



//HS - hidden service
HSVaultMap.init(config.hsVaultMap);


adminRouter.init(app, config, HOST, PORT, adminKeyPath, updatePath);
appRouter.init(config);
app.use("/", appRouter.router);
app.use("/admin", adminRouter.router);



let chat;
//const server = app.listen(PORT, HOST, ()=>{
const server = app.listen(PORT, HOST, async ()=>{
    console.log("running on " + "\nHOST: " + HOST + "\nPORT: " +  PORT);
    chat = new Chat(server, config);
    await chat.runGlobalResync();
});

//
// //TEST ONLY
//let testws = require("./classes/poc/testws");
//testws.init(server);
//
