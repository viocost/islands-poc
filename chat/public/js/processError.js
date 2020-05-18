window.onerror = processDocumentError;
const LENGTHLIMIT = 200;
let logErrors = [];
let oldLog;

(function(){
    oldLog = console.log;
    console.log = function (message) {
        appendClientLog("log: " + message);
        oldLog.apply(console, arguments);
    };
})();

document.addEventListener('DOMContentLoaded', function(event) {
    document.querySelector('#view-logs').addEventListener('click', showLogs);
    document.querySelector('#close-client-logs').addEventListener('click', closeLogs);

});


function showLogs(){
    let logContent = document.querySelector("#client-logs-content")
    logContent.innerHTML = "";
    logErrors.forEach(el=>{
        let newRecord = document.createElement("p");
        newRecord.innerHTML = el;
        logContent.appendChild(newRecord);
    });
    document.querySelector("#client-logs").style.display = "block";
    document.querySelector("#view-logs").style.display = "none";
}


function closeLogs(){
    let logContent = document.querySelector("#client-logs-content")
    logContent.innerHTML = "";
    document.querySelector("#client-logs").style.display = "none";
    document.querySelector("#view-logs").style.display = "block";
}


function appendClientLog(errMsg){
    if (!errMsg){
        return;
    }
    logErrors.push(errMsg);

    if (logErrors.length > LENGTHLIMIT){
        logErrors.splice(0, 20);
    }

}

function processDocumentError(errorMsg, url, lineNumber){
    console.log("Processing error: " + lineNumber);
    oldLog.apply(errorMsg);
    appendClientLog(errorMsg);
    return true;
}
