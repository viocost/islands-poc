const express = require('express');
const router = express.Router();

let VERSION;
let hiddenServiceManager;


module.exports.init = (version)=>{
    VERSION = version;
}


router.get('/', (req, res)=>{
    res.send({
	version: VERSION,
	message: "Hello!"
    });
});

module.exports.router = router;
