const express  = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const bodyParser = require("body-parser");
const logger = require('morgan');
const HOST = '0.0.0.0';
const PORT = 4026;


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.set('views', path.join(__dirname, 'views'));
app.set("view engine", "pug");
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res)=>{
   res.render('index');
});


app.get('/get_history', (req, res)=>{
    try{
        let historyPath = decodeURIComponent(req.query.hpath);
        let historyContent = fs.readFileSync(historyPath);
        console.log("Senbding file content... " );
        res.send(historyContent);
    }catch(err){
        console.log("Error opening history file: " + err);
        res.status(500).send({error: err});
    }

});




app.listen(PORT, HOST, ()=>{
    console.log("App is running on port " + PORT);
});