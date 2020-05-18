const express = require('express');
const app = express();

app.get('/', (req, res)=>{
  console.log(req) ;	
  res.send("Hello TOR1");
});


app.listen(4001, '127.0.0.1', ()=>{
  console.log("Started on 4001");
})
