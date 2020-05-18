console.log("Background script running");

const activeTabs = {};

chrome.tabs.onRemoved.addListener((tabID, info)=>{
    console.log("Deleting data from tab: " + tabID);
    delete window.localStorage[tabID];
    delete activeTabs[tabID]
});


chrome.tabs.onUpdated.addListener((tabID, changeInfo, tab)=>{
    if (activeTabs.hasOwnProperty(tabID) &&
        window.localStorage["state" + tabID] === "true" &&
        changeInfo.status==="complete"){
        console.log("Sending message to tab " + tabID);
        setTimeout(()=>{
            chrome.tabs.sendMessage(tabID, {action: "login", privKey: window.localStorage[tabID]}, (response)=>{
                console.log("Response: " + response);
                console.log("Error: " + chrome.runtime.lastError.message);
            });
        }, 1000)
    }
});




function refreshIslands(){
    console.log("refreshing islands!");
    for (let i of Object.keys(activeTabs)){
        console.log("Reloading tab: " + i);
        chrome.tabs.reload(parseInt(i), undefined, (response)=>{
            console.log("Update response: " + response);
        })
    }

}

function processRequest(request){
    if (request.action === "refresh"){
        refreshIslands();
    } else if(request.action === "add-tab"){
        activeTabs[request.tabID] = true
    }

}

chrome.runtime.onMessage.addListener((request, sender, sendResponse)=>{

    processRequest(request);
});