const express = require("express"),

      app = express(),

      path = require('path'),
      bodyParser = require("body-parser"),
      logger = require('morgan'),
      PORT = 80,
      sleep = require('sleep'),


      controllers = require('./controllers/persistence');


app.set('view engine', 'pug');


app.set('views', path.join(__dirname, 'views'));
app.set("view engine", "pug");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

if (app.get('env') === 'development')
    app.use(logger('dev'));
app.locals.pretty = true;
app.use(express.static(path.join(__dirname, 'public')));

//index route
app.get('/', (req, res)=>{
    res.render('index');
});

//This one is blank yet
app.get('/private', (req, res)=>{
    res.render('private');
});

app.get("/files", (req, res)=>{
   res.render('files');
});



/*****FILES EXPERIMENTS******/
app.get("/files", (req, res)=>{
    res.render('files');
});
app.post("/files", controllers.run_files_experiment);
/*****_END OF FILES EXPERIMENTS******/



//This one is blank yet
app.get('/cryptground', (req, res)=>{
    res.render('cryptground');
});


//This one is blank yet
app.get('/chat', (req, res)=>{
    res.render('chat');
});

//Dictionary of active socket connections
//key is socket id
const USERS_ONLINE = {};


let server = app.listen(PORT, 'localhost', ()=>{
    console.log('app started on port ' + PORT);
});

/*
//raw WS
const WebSocketServer = require('websocket').server
const wsServer = new WebSocketServer({
  httpServer: server
});

// WebSocket server
wsServer.on('request', function(request) {
  var connection = request.accept(null, request.origin);
  
  // This is the most important callback for us, we'll handle
  // all messages from users here.

  let j = 0;
  connection.on('message', (message) =>{
    
      // process WebSocket message
      console.log(message.utf8Data + " " + j);
      ++j;
          
  });




  let i=0;
    while (i<10){
        sendOnce(connection, i);
        ++i;
        sleep.sleep(randInt(6));
    }

});

function sendOnce(socket, i){
    console.log("Sendigng message to CLIENT Island: " + i);
    socket.send(getCurrentDate());
    
}


// async function startSendingTimestamps(socket){
//     let i=0;
//     while (i<10){
//         console.log("Sendigng message to CLIENT Island: " + i)
//         socket.send(getCurrentDate());
//         ++i;
//         sleep.sleep(randInt(4));
        

        
//     }

// }


function randInt (min, max) {
    if (max === undefined) {
        max = min;
        min = 0;
    }

    if (typeof min !== 'number' || typeof max !== 'number') {
        throw new TypeError('Expected all arguments to be numbers');
    }

    return Math.floor(Math.random() * (max - min + 1) + min);
};

function getCurrentDate(){
    d = new Date();
    return d.toString()
}
//raw WS
*/




const io  = require("socket.io").listen(server);

//defining event handlers for socket.io
io.on('connection', (socket)=>{

    console.log("Address: " + socket.handshake.address.address + ":" + socket.handshake.address.port);

    if(socket.handshake.query.name !== undefined){
        //creating new user object
        user = {
            name : socket.handshake.query.name,
            id : socket.id,
        };
        console.log(user.name + ' with id ' + user.id + ' has connected');

        //if User with such id is not already online, add him to USERS_ONLINE
        if (!USERS_ONLINE.hasOwnProperty(socket.id)){
            USERS_ONLINE[socket.id] = user.name;
        }

        console.log(socket.id);
        //returning added socket id
        socket.send(socket.id);

        //asking all the clients to update online users list
        updateOnlineUsersList(socket);
    }

    //
    socket.on('broadcast_msg', (data)=>{
        message = {
            author: USERS_ONLINE[socket.id],
            message: data.message,
            id: socket.id
        };
        console.log(socket);
        socket.emit('new_message', message);
    });

    socket.on('message', (message)=>{
        let data;
        try{
            data = JSON.parse(message)
        } catch(err) {
            console.log('invalid JSON');
            data = {}
        }

        switch(data.type){
            case "offer":
                console.log("sending offer to: " + data.name);
                let conn = USERS_ONLINE[data.id];

                socket.otherName = data.name;

                if (conn !== null){
                    sendTo(conn, {
                       type: "offer",
                       offer: data.offer,
                       name: socket.name
                    });
                }
                break;

            case "answer":
                console.log("Sending answer to: ", data.name);
        }

    });

    //disconnect handler
    socket.on('disconnect', ()=>{
        //removing connected user from USERS_ONLINE dict
        if(USERS_ONLINE.hasOwnProperty(socket.id)){
            userName = USERS_ONLINE[socket.id];
            delete USERS_ONLINE[socket.id];
            console.log('User ' + userName + ' with id ' + socket.id + ' has been disconnected');
        }else{
            console.log('user disconnected');
        }
        //asking all the clients to update online users list
        updateOnlineUsersList(socket);
    });
});

function updateOnlineUsersList(socket){
    socket.emit('update_online_users', USERS_ONLINE);

}

function sendTo(connection, message) {
    connection.send(JSON.stringify(message));
}



io.on('ready', (socket)=>{
    socket.join(socket.data);
    io.room(socket.data).broadcast('announce', {
        message: 'New client in the ' + socket.data + ' room.'
    });
});

module.exports = app;


    
