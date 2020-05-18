function doLogin(privKey){
    console.log("Loggin user in!");
    document.querySelector('#private-key').value = privKey;
    document.querySelector('#login-topic').click();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse)=>{
    console.log("Got message: " + message);
    if (message.action === "login"){
        doLogin(message.privKey);
    }
});


document.onkeydown = function(e){
    if (e.ctrlKey && e.altKey && e.code === "KeyR"){
        console.log("Refreshing all tabs!");
        chrome.runtime.sendMessage({action: "refresh"})
    }

};





