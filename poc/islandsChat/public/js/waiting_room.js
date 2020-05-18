var joinButton = document.querySelector('#join-room-button');
var joinName = document.querySelector('#join-room-name');
var ROOM = 'Waiting room';
var usersTable = document.querySelector('#online-users-list');
var SOCKET_ID;

var socket;



$('#new-msg').keydown(function (e) {
    if (e.ctrlKey && e.keyCode == 13) {
        send_new_message();
    }
});

//Setting up separate socket connection for private call
$('#launch-private-room').click(function(){
    //TURN OFF FOR NOW
    /*
    privateIO = io.connect(null, {
        'force new connection': true,
        'query': 'name=' + joinName.value,
        'private': true
    })*/
});

$('#create-topic').click(function(){
    var nickname = document.querySelector('#nickname');
    var topicName = document.querySelector('#topic-name');
    createNewTopic(nickname, topicName);
});

function createNewTopic(nickname, topicName){

    var chat = new Chat({topicName: topicName, nickname: nickname});
    chat.generateKeys();
    chat.appendCurrentMetadata

    //Generate keypair

    //generate SYM key




}




$('#send-new-msg').click(send_new_message);

$('#join-room-button').click(function (){
    if (joinName.value === ""){
        toastr['warning']('Please enter your name')
    }  else{
        //Connect to a socket
        socket = io.connect(null, {
            'query': 'name=' + joinName.value
        });


        //add name to the online table

        socket.emit('ready', ROOM);
        socket.on('announce', function (data) {
            displayMessage(data.message);
        });

        socket.on('new_message', function(data){
            append_new_message(data)
        });

        socket.on('connect', function(data){
            //hide connection element
            $('#enter_name').hide();

            //display you are online
            $('#user-name').html("<i class='fa fa-user-circle-o online' aria-hidden='true'></i><b>" +"   " + joinName.value + ",</b> you are now online").css('display: block;');

            $('#chat_room').css('display','flex');
            //SOCKET_ID = socket.socket.transport.sessid;

        });

        socket.on('update_online_users', function (data) {
            usersTable.innerHTML = "";
            for (key in data) {

                if (data.hasOwnProperty(key)) {
                    var row = document.createElement('div');
                    var id = document.createElement('div');
                    var circle = document.createElement('div');
                    var username = document.createElement('div');
                    row.classList.add('online-user-row')
                    id.classList.add('online-user-id');
                    circle.classList.add('online-user-icon');
                    username.classList.add('online-user-username');
                    id.innerHTML = key;
                    circle.innerHTML = "<i class='fa fa-circle' aria-hidden='true'> <i/>";
                    username.innerHTML = data[key];
                    row.appendChild(id);
                    row.appendChild(circle);
                    row.appendChild(username);
                    usersTable.appendChild(row);
                }
            }
        })
    }
})

chatArea = document.querySelector('#chatArea');

function updateOnlineUsersList(){
    var usersTable = document.querySelector('#users_table')
    usersTable.innerHTML = "";

}

function send_new_message(){
    var newMessageField = $('#new-msg');
    var message = newMessageField.val().trim();
    if (message === ""){
        toastr['warning']('Please enter new message!');
        return;
    }
    //send message
    socket.emit('broadcast_msg', {'message': message})
    newMessageField.val("");
}

function displayMessage(message){
    toastr["info"]("Welcome to waiting room!")
}

function append_new_message(message){
    var chatWindow = document.querySelector('#chat_window');
    var msg =  document.createElement('div');
    var message_heading = document.createElement('div');
    var message_body = document.createElement('div');
    var time_stamp = document.createElement('span');
    time_stamp.innerHTML = get_current_time();
    time_stamp.classList.add('msg-time-stamp');
    message_heading.classList.add('msg-heading');
    message_body.classList.add('msg-body');

    if (is_my_message(message.id) ){
        // My message
        msg.classList.add('my_message');
        message_heading.appendChild(time_stamp)
        message_heading.innerHTML += '<b>  '+ message.author +'</b>'
    } else {
        //Not my Message
        message_heading.innerHTML += '<b>' + message.author + '  </b>'
        message_heading.appendChild(time_stamp)
        msg.classList.add('message');
    }


    message_body.innerHTML = message.message;
    //msg.innerHTML = '<b>'+message.author +'</b><br>' + message.message;
    msg.appendChild(message_heading);
    msg.appendChild(message_body);
    chatWindow.appendChild(msg);
    chatWindow.scrollTop = chatWindow.scrollHeight;

}

function is_my_message(message_id){
    return message_id === SOCKET_ID;
}

function get_current_time(){
    d = new Date();
    return d.getHours() + ':' + d.getMinutes()
}


