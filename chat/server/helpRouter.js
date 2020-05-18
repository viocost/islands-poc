const express = require("express");
const router = express.Router();


router.get('/', (req, res)=>{
    res.render("help", {version: global.VERSION, title: "Islands chat - USER GUIDE", chapter: "main" })
});


module.exports = router;
