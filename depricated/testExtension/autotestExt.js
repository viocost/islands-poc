document.addEventListener('DOMContentLoaded', function (){

    if(!window.localStorage.islandsTest){
        window.localStorage.islandsTest = {};
    }

    let privKeyField = document.getElementById("priv-key");
    let urlField = document.getElementById("islands-url");

    document.querySelector("#save-button").addEventListener("click", ()=>{
        chrome.tabs.getSelected((tab)=>{
            window.localStorage[tab.id] =  privKeyField.value
            window.localStorage["state" + tab.id] = true;
            let toggleButton = document.querySelector('#toggle')
            toggleButton.classList.remove("off");
            toggleButton.classList.add("on");
            chrome.runtime.sendMessage({action: "add-tab", tabID: tab.id})
        });
    });

    document.querySelector("#set-url").addEventListener("click", ()=>{
        if (!urlField.value){
            chrome.tabs.getSelected((tab)=>{
                window.localStorage.islandsUrl =  tab.url;
                urlField.value =  tab.url;
            });
        } else{
            window.localStorage.islandsUrl = urlField.value;
        }
    });

    document.querySelector("#refresh-button").addEventListener("click", ()=>{
        chrome.runtime.sendMessage({action: "refresh"})
    });


    chrome.tabs.getSelected((tab)=>{
        privKeyField.value =  window.localStorage[tab.id] ? window.localStorage[tab.id] : "";
        urlField.value = window.localStorage.islandsUrl ? window.localStorage.islandsUrl : "";

    });

    document.querySelector('#toggle').addEventListener("click", (event)=>{
        chrome.tabs.getSelected((tab)=>{
            if(window.localStorage["state" + tab.id] === "true"){
                window.localStorage["state" + tab.id] = false;
                event.target.classList.remove("on");
                event.target.classList.add("off");

            }else{
                window.localStorage["state" + tab.id] = true;
                event.target.classList.remove("off");
                event.target.classList.add("on");
            }
        });
    });


    privKeyField.value = window.localStorage.privKey ? window.localStorage.privKey : "";

});


