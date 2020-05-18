const express  = require('express');
const app = express();

const io = require("socket.io");


let HOST = 'localhost';
let PORT = 4020;




app.set('views', path.join(__dirname, 'views'));
app.set("view engine", "pug");
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res)=>{
    res.render('index');
});

let server = app.listen(PORT, HOST, ()=>{
    console.log("App is running on port " + PORT);
});



socket = io.listen(server);


socket.on('connection', (socket)=>{
    console.log("New connection from ");
});
