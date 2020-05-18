let keys = {};
let metas = {};


document.addEventListener('DOMContentLoaded', (event)=>{
    document.querySelector('#is-path').addEventListener('click', setInputType);
    document.querySelector('#process-history').addEventListener('click', processHistory)
    document.querySelector('#add-key').addEventListener('click', addKey)
    document.querySelector('#clear').addEventListener('click', ()=>{
        document.querySelector('#output').innerHTML = "";
    });
    document.querySelector('#load-history').addEventListener('click', loadHistory);
});


function loadHistory(){
    let path = document.querySelector('#history-path').value.trim();
    $.ajax({
        url: "get_history?hpath=" + encodeURIComponent(path),
        success: processHistoryData,
        error: (xhr,status,error)=>{
            console.log("ERROR: " + error);
            alert(xhr.responseText);
        }
    })
}


function processHistoryData(result,status,xhr){
    console.log("Successfull call!");
    document.querySelector('#history').value = result;
    toastr["info"]("History is added successfully!");
}

function setInputType(){
    document.querySelector('#history').style.display =
        document.querySelector('#is-path').checked ? "none": "block";
    document.querySelector('#history-path').style.display =
        document.querySelector('#is-path').checked ? "block": "none"
}


function addKey(){
    try{
        let keyData = document.querySelector('#private-key');
        let ic = new iCrypto();
        ic.setRSAKey("pk", keyData.value, "private")
            .publicFromPrivate("pk", "pub")
            .getPublicKeyFingerprint("pub", "pkfp");
        keys[ic.get("pkfp")] = ic.get("pk");
        keyData.value = "";
        toastr["info"]("Private key is added!" );
    }catch(e){alert(e)}
}

function processHistory(){
    let historyData = document.querySelector('#history').value;
    let result = "";
    let output = document.querySelector('#output');
    historyData  = historyData.split(/\d{64}/);


    for (let blob of historyData){
        if (!blob.includes("participants") && !blob.includes("publicKey") ){
            continue
        }
        try{

            blob = JSON.parse(blob);
            let pkfps = Object.keys(blob.body.participants);
            let keysKeys  = pkfps.filter((n)=>{
                return Object.keys(keys).indexOf(n) !== -1;
            });
            if (keysKeys.length === 0) continue
            console.log("Parsing metadata");
            let sharedKeyEnc = blob.body.participants[keysKeys[0]].key
            let ic = new iCrypto;
            ic.addBlob("symciph",sharedKeyEnc)
                .hexToBytes("symciph", "symcip")
                .setRSAKey("pk", keys[keysKeys[0]], "private")
                .privateKeyDecrypt("symcip", "pk", "sym");
            metas[blob.body.id] = ic.get("sym")
        }catch(e){
            console.trace(e)
        }
    }

    for (let i=0; i<historyData.length; ++i){
        let obj;
        let isMeta;
        try{
            isMeta = historyData[i].includes("publicKey") &&  historyData[i].includes("participants");
            obj = JSON.parse(historyData[i])
        } catch(err){continue}

        if (!isMeta){

            tryDecryptMessage(obj)
        }

        let newBlob = document.createElement("pre");
        let code =  document.createElement("code");
        code.innerHTML = jsonPrettyPrint.toHtml(obj);
        newBlob.appendChild(code);
        output.appendChild(newBlob);
    }

    toastr["info"]("History is processed!" );
}

function tryDecryptMessage(obj){
    let id = obj.header.metadataID;
    try{
        if(!id || !metas.hasOwnProperty(id)) return;
        let ic = new iCrypto;
        ic.addBlob("enchex", obj.body)
            .hexToBytes("enchex", "enc")
            .setSYMKey("sym", metas[id])
            .AESDecrypt("enc", "sym", "dec");
        obj.body = ic.get("dec")
    } catch(err){
        toastr.error("Error decrypting metadata " + id)
    }

}

var jsonPrettyPrint = {
    replacer: function(match, pIndent, pKey, pVal, pEnd) {
        var key = '<span class=json-key>';
        var val = '<span class=json-value>';
        var str = '<span class=json-string>';
        var r = pIndent || '';
        if (pKey)
            r = r + key + pKey.replace(/[": ]/g, '') + '</span>: ';
        if (pVal)
            r = r + (pVal[0] == '"' ? str : val) + pVal + '</span>';
        return r + (pEnd || '');
    },
    toHtml: function(obj) {
        var jsonLine =
            /^( *)("[\w]+": )?("[^"]*"|[\w.+-]*)?([,[{])?$/mg;
        return JSON.stringify(obj, null, 3)
            .replace(/&/g, '&amp;').replace(/\\"/g, '&quot;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(jsonLine, jsonPrettyPrint.replacer);
    }
};
