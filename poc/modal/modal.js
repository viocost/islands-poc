
function createModal(){
    let modal = document.createElement("div");
    modal.classList.add("modal")
    let modalContent = document.createElement("div");
    let header =  document.createElement("div");



}

function showModal(){

}


function getModalStyle(){
    return "{\n" +
        "  display: none; /* Hidden by default */\n" +
        "  position: fixed; /* Stay in place */\n" +
        "  z-index: 1; /* Sit on top */\n" +
        "  padding-top: 100px; /* Location of the box */\n" +
        "  left: 0;\n" +
        "  top: 0;\n" +
        "  width: 100%; /* Full width */\n" +
        "  height: 100%; /* Full height */\n" +
        "  overflow: auto; /* Enable scroll if needed */\n" +
        "  background-color: rgb(0,0,0); /* Fallback color */\n" +
        "  background-color: rgba(0,0,0,0.4); /* Black w/ opacity */\n" +
        "}"
}

function getModalContentStyle(){
    return "{\n" +
        "  position: relative;\n" +
        "  background-color: #fefefe;\n" +
        "  margin: auto;\n" +
        "  padding: 0;\n" +
        "  border: 1px solid #888;\n" +
        "  width: 80%;\n" +
        "  box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2),0 6px 20px 0 rgba(0,0,0,0.19);\n" +
        "  -webkit-animation-name: animatetop;\n" +
        "  -webkit-animation-duration: 0.4s;\n" +
        "  animation-name: animatetop;\n" +
        "  animation-duration: 0.4s\n" +
        "}"
}