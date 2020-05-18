const express = require('express');
const app = express();

app.get('/', (req, res)=>{
  res.send("Hello TOR");
});


app.listen(4000, '127.0.0.1', ()=>{
  console.log("Started on 4000");
})
