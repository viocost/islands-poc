import '../css/admin.sass';
import { XHR } from "./lib/xhr";
import toastr from "./lib/toastr";
window.toastr = toastr;
import { Vault } from "./lib/Vault";
import * as CuteSet from "cute-set";
import * as dropdown from "./lib/dropdown";
import * as editableField from "./lib/editable_field";
import { ChatUtility } from "./lib/ChatUtility";
import { BlockingSpinner } from "./lib/BlockingSpinner"
import { verifyPassword } from "./lib/PasswordVerify";
import * as util from "./lib/dom-util";
import { iCrypto } from "./lib/iCrypto"
import * as semver from "semver"
window.semver = semver;
let adminSession;
let filterFieldSelector;
let logTableBody;

let spinner = new BlockingSpinner()
window.util = util;

window.iCrypto = iCrypto


let VERSION;

//////////////////////////////////////////////////////////////////////////////////////////
// window.testCrypto = ()=>{                                                            //
//                                                                                      //
//     let passwd = "hfgkhsdjf"                                                         //
//     let stuff = "kljfgljsdkfgkdjgfdjlkfgjljgewjrkgjegjdjfgjdsgjsdfgdssdljvdcvjdcjv"; //
//     let ic = new iCrypto();                                                          //
//     ic.createNonce("salt", 128)                                                      //
//         .encode("salt","hex", "salt-hex")                                            //
//         .createPasswordBasedSymKey("key", passwd, "salt-hex")                        //
//         .addBlob("vault", stuff)                                                     //
//         .AESEncrypt("vault", "key", "cipher")                                        //
//         .encode("cipher","hex",  "cip-hex")                                          //
//         .merge(["salt-hex", "cip-hex"], "res")                                       //
//                                                                                      //
//     let vault_encrypted = ic.get("res");                                             //
//                                                                                      //
//     let icn = new iCrypto()                                                          //
//     icn.addBlob("s16", vault_encrypted.substring(0, 256))                            //
//         .addBlob("v_cip", vault_encrypted.substr(256))                               //
//         .hexToBytes("s16", "salt")                                                   //
//         .createPasswordBasedSymKey("sym", passwd, "s16")                             //
//                                                                                      //
//     console.log(ic.get("cip-hex") === v_cip);                                        //
//     icn.AESDecrypt("v_cip", "sym", "vault_raw", true);                               //
// }                                                                                    //
//                                                                                      //
// window.testVault = ()=>{                                                             //
//     let v = new Vault()                                                              //
//     let pass = "jhdfgdslhglsdhgljhghdsfgh"                                           //
//     v.init(pass)                                                                     //
//     let cip = v.pack()                                                               //
//     let dec = new Vault()                                                            //
//     dec.initSaved(cip.vault, pass)                                                   //
// }                                                                                    //
//////////////////////////////////////////////////////////////////////////////////////////

/**
 * Closure for processing admin requests while admin logged in
 * Initialized when admin logs in
 * @data - Object with request data
 * @onSuccess - success handler
 * @onError - error handler
 */
let processAdminRequest = ()=>{
    throw new Error("Admin session uninitialized");
};


document.addEventListener('DOMContentLoaded', event => {
    if(!getVersion){
        throw new Error("getVersion is not defined!")
    }
    VERSION = getVersion();
    document.title = "Islands | Admin login";
    util.$("main").classList.add("main-admin");
    util.$("header").style.minWidth = "111rem";
    if (!secured){
        console.log("Secured is false!");
        util.$('#island-setup').addEventListener('click', setupIslandAdmin);
        util.$("#setup--wrapper").addEventListener("keypress", (ev)=>{
            if (ev.which === 13 || ev.keyCode === 13) {
                setupIslandAdmin();
            }
        });
        util.displayFlex('#setup--wrapper');
        return ;
    }
    util.$('#admin-login').onclick = adminLogin;
    util.$("#admin-login--wrapper").addEventListener("keypress", (ev)=>{
        if (ev.which === 13 || ev.keyCode === 13) {
            adminLogin();
        }
    })


    util.$('#download-logs').onclick = ()=>{loadLogs(false, true);};
    util.$('#add-admin-service').onclick = addAdminHiddenService;
    util.$('#add-guest-service').onclick = createGuest;


    //util.$('#to-chat').onclick = returnToChat;
    //util.$('#admin-logout-button').onclick = adminLogout;

    util.$('#clear-logs').onclick = clearLogs;
//
    //util.displayFlex('#admin-login--wrapper');



    util.$$('.update-option').forEach(el => {
        el.onclick = switchUpdateOption;
    });

    logTableBody = util.$("#log-content").lastElementChild;
    filterFieldSelector = util.$('#filter-field-selector');
    filterFieldSelector.addEventListener("change", filterLogs);
    util.$("#log-filter").addEventListener("keypress", filterLogs);
    util.$('#log-reverse').onclick = reverseLogList;
    prepareAdminMenuListeners();
    prepareLogPageListeners();
    autoLogin();
});


function autoLogin(){

    let url = new URL(window.location.href);
    let id = url.searchParams.get("id");
    if(!id) return;
    loadingOn();
    let token = url.searchParams.get("token");
    let pkcipher = localStorage.getItem(id);
    if (!pkcipher){
        loadingOff();
        throw new Error("Autologin failed: no private ley found in local storage");
    }

    let ic = new iCrypto();
    ic.addBlob("pkcip", pkcipher)
        .addBlob("key", token)
        .AESDecrypt("pkcip", "key", "privk", true, "CBC", "utf8");
    let privateKey = ic.get("privk");

    requestAdminLogin(privateKey)
        .then(()=>{})
        .catch(()=>{});
    localStorage.removeItem(id);
}


//*********ISLAND ACCESS SECTION*********************//

function addAdminHiddenService(){
    try{
        processAdminRequest({
            action: "launch_admin_hidden_service",
            permanent: true
        }, (data)=>{
            toastr.success("Admin hidden service created!")
            onHiddenServiceUpdate(data)
        }, (err)=>{
            toastr.warning(`Error creating admin hidden service${err ? ": " + err : ""} `)
            displayServerRequestError(err);
        })

    } catch (err) {
        toastr.warning("Error creating admin hidden service: " + err.message);
    }
}

function createGuest() {
    try{
        let ic = new iCrypto();
        ic.createNonce("n")
            .setRSAKey("privk", adminSession.privateKey, "private")
            .privateKeySign("n", "privk", "sign")
            .bytesToHex("n", "nhex");
        processAdminRequest({
            action: "create_guest",
            vaultID: ic.get("nhex"),
            sign: ic.get("sign"),
            permanent: true
        }, (data)=>{
            toastr.success("Guest hidden services created!")
            onHiddenServiceUpdate(data)
        }, (err)=>{
            toastr.warning(`Error creating guest hidden service${err ? ": " + err : ""} `)
            displayServerRequestError(err)
        })

    } catch (err) {
        toastr.warning("Error creating admin hidden service: " + err.message);
    }
}


function enableHiddenService(ev){
    let onion = ev.target.parentNode.parentNode.parentNode.parentNode.children[1].innerText;

    try{
        processAdminRequest({
            action: "enable_hidden_service",
            onion: onion

        }, onHiddenServiceUpdate, displayServerRequestError)
    }catch(err){
        displayServerRequestError(err)
    }
}

function disableHiddenService(ev){
    let onion = ev.target.parentNode.parentNode.parentNode.parentNode.children[1].innerText;

    try{
        processAdminRequest({
            action: "disable_hidden_service",
            onion: onion
        }, onHiddenServiceUpdate, displayServerRequestError)
    }catch(err){
        displayServerRequestError(err)
    }
}



/**
 * Deactivates and deletes hidden service
 * If it is guest hidden service - delet
 *
 * @param ev
 */
function deleteGuest(ev){
    try{
        let row = ev.target.parentNode.parentNode.parentNode.parentNode;
        let onion = row.children[1].innerText;
        let isAdmin = /admin/i.test(row.children[3].innerText);
        if(isAdmin){
            throw new Error("Only applicable to guest hidden service");
        }
        if(!confirm("This will delete permanently hidden service and associated with it guest vault." +
            "After this operation guest will no longer be able to access this island. \n\nProceed?")){
            return
        }
        processAdminRequest({
            action: "delete_guest",
            onion: onion
        }, onHiddenServiceUpdate, displayServerRequestError)
    }catch(err){
        toastr.warning("Error deleting guest: " + err);
        console.error(err);
    }
}

function deleteAdminHiddenService(ev){
    let row = ev.target.parentNode.parentNode.parentNode.parentNode;
    let onion = row.children[1].innerText;
    let isAdmin = /admin/i.test(row.children[3].innerText);
    try{
        if(!isAdmin){
            throw new Error("Only applicable to admin hidden service");
        }
        processAdminRequest({
            action: "delete_hidden_service",
            onion: onion
        }, onHiddenServiceUpdate, displayServerRequestError)
    }catch(err){
        toastr.warning("Error deleting guest: " + err);
        console.error(err);
    }
}


function displayServerRequestError(err){
    toastr.warning("Error creating admin hidden service: " + err.responseText)
}

//TODO finish method!
// function deleteHiddenService(ev) {
//     let onion = ev.target.previousSibling.innerHTML;
//
//     let privKey = adminSession.privateKey;
//     let pkfp = adminSession.pkfp;
//     let ic = new iCrypto();
//     ic.createNonce('n').setRSAKey("pk", privKey, 'private').privateKeySign('n', 'pk', 'sign').bytesToHex('n', 'nhex');
//
//     XHR({
//         type: "POST",
//         url: "/admin",
//         dataType: "json",
//         data: {
//             action: "delete_hidden_service",
//             nonce: ic.get('nhex'),
//             sign: ic.get('sign'),
//             pkfp: pkfp,
//             onion: onion
//         },
//         success: processIslandHiddenServiceDeletion,
//         err: err => {
//             console.log("Error deleting hidden service: " + err);
//         }
//     });
// }



/**
 * Updates list of running Island hidden services
 * @param {Array} hiddenServices
 */
function updateHiddenServicesList(hiddenServices) {
    let hsContainer = util.$("#hidden-services-wrap");
    hsContainer.innerHTML = "";
    let count = 0;
    for (let key of Object.keys(hiddenServices)) {
        let hsWrap = document.createElement("div");
        let num = document.createElement("div");
        let val = document.createElement("div");
        let del = document.createElement("div");
        hsWrap.classList.add("hidden-service");
        num.classList.add("hs-num");
        val.classList.add("hs-val");
        del.classList.add("hs-del");
        let enumer = count + 1;
        num.innerHTML = "#" + enumer;
        val.innerHTML = hiddenServices[key].id.substring(0, 16) + ".onion";
        del.innerHTML = "Delete";
        del.addEventListener("click", deleteGuest);
        hsWrap.appendChild(num);
        hsWrap.appendChild(val);
        hsWrap.appendChild(del);
        hsContainer.appendChild(hsWrap);
        count ++;
    }
}



function onHiddenServiceUpdate(data) {

    let hiddenServices = JSON.parse(data.hiddenServices);

    let tableBody = util.$("#hidden-services-wrap");
    tableBody.innerHTML = "";
    let enumer = 1;
    for (let key of Object.keys(hiddenServices)){
        let isEnabled = hiddenServices[key].enabled;
        let row = util.bake("tr");
        let enumEl = util.bake("td", {class: "hs-enum", text: enumer});
        let link = util.bake("td", {class: "hs-link", text: key + ".onion"});

        let description = extractDescription(hiddenServices[key].description)

        let hsDesc = bakeDescriptionElement(util.bake("td", {class: "hs-desc"}), description);
        let hsType = util.bake("td", {class: "hs-type", text: hiddenServices[key].admin ? "Admin" : "User"});
        let status = util.bake("td", {class: ["hs-status", isEnabled ? "hs-status-enabled" : "hs-status-disabled" ],
            text: isEnabled ? "Enabled" : "Disabled"});
        let actions = bakeHsRecordActionsMenu(util.bake("td", {class: "hs-actions"}),
            hiddenServices[key].admin);
        util.appendChildren(row, [enumEl, link, hsDesc, hsType, status, actions]);
        tableBody.appendChild(row);
        enumer++;
        link.addEventListener("click", (ev)=>{
            copyTextToBuffer(ev.target.innerText, "Onion link copied to clipboard")
        })
    }
    onHiddenServicesPageActivation();
}


function extractDescription(cipher){
    if (cipher === undefined || cipher === ""){
        return "";
    }
    return ChatUtility.decryptStandardMessage(cipher, adminSession.privateKey);
}

function bakeDescriptionElement(cell, description){
    let field = editableField.bakeEditableField("Place for description",  "editable-field-gray");
    field.addEventListener("change", updateHSDescription);
    field.addEventListener("keypress", ev=>{
        if (ev.which === 13 || ev.keyCode === 13) {
            document.activeElement.blur();
        }
    });
    field.value = description;
    cell.appendChild(field);
    return cell
}


function updateHSDescription(ev){
    let description = ev.target.value.trim();
    let cipher = "";
    let row = ev.target.parentNode.parentNode;
    let onion = row.children[1].innerText;
    if(description && description !== ""){
        cipher = ChatUtility.encryptStandardMessage(description, adminSession.publicKey);
    }

    try{
        processAdminRequest({
            action: "update_hs_description",
            onion: onion,
            description: cipher
        }, onHiddenServiceUpdate, displayServerRequestError)
    }catch(err){
        toastr.warning("Error deleting guest: " + err);
        console.error(err);
    }
}

/**
 * Creates dropdown menu "Actions" for each hidden service running
 * @param cell
 * @isAdmin boolean
 * @returns {*}
 */
function bakeHsRecordActionsMenu(cell, isAdmin){
    cell.appendChild(dropdown.bakeDropdownMenu("Actions",
        {
            "Copy onion link": (ev)=>{
                let text = ev.target.parentNode.parentNode.parentNode.parentNode.children[1].innerText;
                copyTextToBuffer(text, "Onion link copied to clipboard")
            },
            "Enable" : enableHiddenService,
            "Disable": disableHiddenService,
            "Delete": isAdmin? deleteAdminHiddenService : deleteGuest
        }));
    return cell
}


/**
 * Copies passed text to clipboard
 * @param text - text to copy
 * @param message - message to display
 */
function copyTextToBuffer(text, message){
    let textArea = util.bake("textarea");
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand("copy");
        toastr.info(message);
    } catch (err) {
        toastr.error("Error copying invite code to the clipboard");
    }
    textArea.remove();
}





//*********END ISLAND ACCESS SECTION*********************//


// function onionAddressFromPrivateKey(privateKey) {
//     let ic = new iCrypto();
//     ic.setRSAKey("privk", privateKey, "private").publicFromPrivate("privk", "pubk");
//     let pkraw = forge.pki.publicKeyFromPem(ic.get("pubk"));
//     let pkfp = forge.pki.getPublicKeyFingerprint(pkraw, { encoding: 'hex', md: forge.md.sha1.create() });
//     if (pkfp.length % 2 !== 0) {
//         s = '0' + s;
//     }
//     let bytes = [];
//     for (let i = 0; i < pkfp.length / 2; i = i + 2) {
//         bytes.push(parseInt(pkfp.slice(i, i + 2), 16));
//     }
//
//     return base32.encode(bytes).toLowerCase() + ".onion";
// }



function adminLogin() {
    let password = util.$("#admin-password").value.trim();
    if(!password){
        toastr.warning("Password is required!");
        return;
    }
    loadingOn();

    //Request admin vault
    XHR({
        type: "GET",
        url: "/admin/vault",
        success: async res =>{
            try{
                console.log("Decryptting admin vault");
                let decryptedVault = await decryptVault(res.vault.vault, password);
                await requestAdminLogin(decryptedVault.adminKey);
            }catch(err){
                loadingOff();
                toastr.warning("Login failed. Check the password and try again.");
                console.log("Login error: " + err);
            }

        },
        error: async err=>{
            loadingOff();
            toastr.warning("Admin login error: " + err)
        }
    });
}


/**
 * Decrypt the vault, get admin record, process the normal login
 * @param vaultCipher
 * @param password
 * @returns {Promise<void>}
 */
function decryptVault(vaultEnc, password){
    return new Promise((resolve, reject)=>{
        try{
            let vault = new Vault();
            vault.initSaved(VERSION, vaultEnc, password);
            if(!vault.admin || !vault.adminKey){
                reject("Admin vault is invalid, or doesn't have a private key")
            }
            resolve(vault);
        }catch(err){
            reject(err);
        }
    })
}

async function requestAdminLogin (privateKey){
    try {
        let ic = new iCrypto();
        ic.createNonce('n').setRSAKey("pk", privateKey, 'private').privateKeySign('n', 'pk', 'sign').bytesToHex('n', 'nhex').publicFromPrivate("pk", "pub").getPublicKeyFingerprint("pub", "pkfp");
        XHR({
            type: "POST",
            url: "/admin",
            dataType: "json",
            data: {
                action: "admin_login",
                nonce: ic.get('nhex'),
                sign: ic.get('sign'),
                pkfp: ic.get("pkfp")
            },
            success: res => {
                adminSession = {
                    publicKey: ic.get('pub'),
                    privateKey: ic.get('pk'),
                    pkfp: ic.get('pkfp')
                };

                processAdminRequest = prepareRequestProcessor(adminSession);

                util.displayFlex('#admin-content-wrapper');
                util.html('.heading__main', "Rule your island");
                util.displayNone('#admin-login--wrapper');
                processLoginData(res);
                displayAdminMenu(true);
                loadingOff();
                toastr.info("Admin login successfull!");
                document.title = "Islands | Admin panel"
            },

            error: err => {
                loadingOff();
                toastr.warning("Error: \n" + err.responseText);
            }
        });
    } catch (err) {
        loadingOff();
        clearAdminPrivateKey();
        toastr.warning("Login error: \n" + err);
    }
}

function processLoginData(res) {
    let loggerState = res.loggerInfo.enabled === "true" || res.loggerInfo.enabled === true;
    let loggerLevel = res.loggerInfo.level;
    util.val("#logs-state", loggerState ? "true" : "false");
    util.val("#log-highest-level", loggerLevel);
    onHiddenServiceUpdate(res);
}

function setupIslandAdmin() {

    console.log("Setting up admin");
    util.addClass('#island-setup', 'btn-loading');

    let password = util.$('#new-admin-password').value;
    let confirm = util.$('#new-admin-password-confirm').value;
    let error  = verifyPassword(password, confirm);
    if(error){
        toastr.warning(error);
        loadingOff();
        return;
    }

    setupAdminContinue(password).then(() => {
        toastr.info("Setup successfull!!");
    }).catch(err => {
        toastr.error(err);
    });
}

function setupAdminContinue(password) {
    console.log("Setup admin continue called");
    return new Promise((resolve, reject) => {
        loadingOn();
        let ic = new iCrypto();
        ic.generateRSAKeyPair("adminkp")
            .createNonce("n")
            .privateKeySign("n", "adminkp", "sign")
            .bytesToHex("n", "nhex");


        let vault = new Vault();
        vault.initAdmin(password, ic.get("adminkp").privateKey, version);


        let vaultEncData = vault.pack();
        let vaultPublicKey = vault.publicKey;
        let adminPublicKey = ic.get("adminkp").publicKey;

        console.log(`sending register request. Hash: ${vaultEncData.hash}`);


        XHR({
            type: "POST",
            url: "/admin",
            dataType: "json",
            data: {
                action: "admin_setup",
                adminPublickKey: adminPublicKey,
                hash: vaultEncData.hash,
                nonce: ic.get('nhex'),
                sign: ic.get("sign"),
                vault: vaultEncData.vault,
                vaultPublicKey: vaultPublicKey,
                vaultSign: vaultEncData.sign
            },
            success: () => {
                console.log("Success admin register");
                loadingOff();
                adminSession = {
                    publicKey: ic.get('adminkp').publicKey,
                    privateKey: ic.get('adminkp').privateKey
                };
                util.$("#setup--wrapper").style.display = "none";
                util.$("#registration-complete--wrapper").style.display = "flex";


                util.removeClass('#island-setup', 'btn-loading');
                resolve();
            },
            error: err => {
                loadingOff();
                console.log(err.message);
                reject("Fail!" + err);
                UTIL.REMOVECLASS('#ISLAND-SETUP', 'BTN-LOADING');
            }
        });
    });
}

function loadingOn() {
    spinner.loadingOn();
}

function loadingOff() {
    spinner.loadingOff();
}
function returnToChat() {
    adminSession = undefined;
    clearAdminPrivateKey();
    document.location = "/";
}

function adminLogout() {
    displayAdminMenu(false);
    adminSession = undefined;
    clearAdminPrivateKey();
    document.location.reload();
}

function displayAdminMenu(on) {
    //on ? util.displayFlex("#admin-menu") : util.displayNone("#admin-menu")
}

function prepareAdminMenuListeners() {
    util.$("#island-admin-main-menu").childNodes.forEach(node => {
        node.addEventListener("click", processMainMenuClick);
    });
}

function processMainMenuClick(ev) {
    if (ev.target.classList.contains("active")) {
        return;
    }
    let menu = util.$("#island-admin-main-menu");
    for (let item of menu.children) {
        item.classList.remove("active");
    };

    let pages = util.$("#admin-pages");
    for (let item of pages.children) {
        item.classList.remove("active");
    };

    let index = getElementIndex(ev.target);

    pages.children[index].classList.add("active");
    menu.children[index].classList.add("active");
    util.$("#admin-section-heading").innerHTML = ev.target.innerHTML;
    runPageActivationHandler(index);
}

function runPageActivationHandler(index){
    console.log("Running page activation handler for index: " + index)
    switch (index){
	case 0:
	    onHiddenServicesPageActivation();
	    break;
	case 1:
	    onLogsPageActivation();
	    break
	default:
	        throw new Error("Invaild page index")
    }
}

function onHiddenServicesPageActivation(){
    let hsExist = util.$("#hidden-services-wrap").children.length === 0 
    util.$("#hs-container").style.display = hsExist ? "none" : "block" 
    util.$("#hidden-services-empty").style.display = hsExist ? "block" : "none" 
}

function onLogsPageActivation(){
    let logsExist = util.$("#log-records").children.length === 0;
    util.$("#logs-empty-message").style.display = logsExist ? "block" : "none";
    util.$("#log-content").style.display = logsExist ? "none" : "block";
}

function clearAdminPrivateKey() {
    util.val("#admin-private-key", "");
}

function getElementIndex(node) {
    let index = 0;
    while (node = node.previousElementSibling) {
        index++;
    }
    return index;
}

function loadLogs(errorsOnly = false, download = false) {
    loadingOn()
    let privKey = adminSession.privateKey;
    let pkfp = adminSession.pkfp;
    let ic = new iCrypto();
    ic.createNonce('n').setRSAKey("pk", privKey, 'private').privateKeySign('n', 'pk', 'sign').bytesToHex('n', 'nhex');

    XHR({
        type: "POST",
        url: "/admin",
        dataType: "json",
        data: {
            action: "load_logs",
            nonce: ic.get('nhex'),
            sign: ic.get('sign'),
            pkfp: pkfp,
            errorsOnly: errorsOnly
        },
        success: download ? downloadLogs: processLogsLoaded,
        error: err => {
            console.log("Error loading logs: " + err);
            toastr.warning("Error loading logs: " + err);
        },

        complete: ()=>{
            console.log("Loading completed!")
            loadingOff()
        }
    });
}


function downloadLogs(res){
    console.log("Records received, downloading logs.");

    let url = URL.createObjectURL(new Blob([res.records], {type: "text/json"}))
    let dateOptions = {year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"}
    let el = util.bake("a", {
        attributes: {
            //href: "data:text/plain;charset=utf-8," + encodeURIComponent(records),
            href: url,
            download: `islands_${new Date().toLocaleTimeString(navigator.language, dateOptions)}.log`,
            style: "display: none;"
        }
    });
    document.body.appendChild(el)
    el.click();
    document.body.removeChild(el);
}



function processLogsLoaded(res) {
    console.log(res.records);
    if(!res.records){
        console.log("Server returned no logs")
        return
    }

    let records = res.records.split("\n");
    let table = util.$("#log-content").lastElementChild;
    table.innerHTML = "";
    for (let record of records) {
        let parsed;
        try {
            parsed = JSON.parse(record);
        } catch (err) {
            continue;
        }

        let row = document.createElement("tr");
        row.classList.add(parsed.level);
        let ts = document.createElement("td");
        let level = document.createElement("td");
        let msg = document.createElement("td");
        ts.classList.add("log-timestamp");
        level.classList.add("log-level");
        msg.classList.add("log-msg");
        ts.innerHTML = parsed.timestamp;
        level.innerHTML = parsed.level;
        msg.innerHTML = parsed.message;
        row.append(ts);
        row.append(level);
        row.append(msg);
        let additionalValues = new CuteSet(Object.keys(parsed)).minus(["level", "message", "timestamp"]);
        if (additionalValues.length() > 0) {
            let addCell = util.bake("td", {class: "add-value-cell"});
            for (let key of additionalValues) {
                let wrap = document.createElement("div");
                wrap.classList.add("log-add-value");
                let k = document.createElement("div");
                let b = document.createElement("b");
                k.classList.add("log-key");
                let v = document.createElement("div");
                v.classList.add("log-val");
                b.innerHTML = key;
                k.appendChild(b);
                v.innerHTML = parsed[key];
                wrap.appendChild(k);
                wrap.appendChild(v);
                addCell.appendChild(wrap);
                row.appendChild(addCell);
            }
        }
        table.appendChild(row);
    }
    onLogsPageActivation();
    toastr.info("Logs loaded successfully");
}

function requestLoggerStateChange(ev) {
    let selectedElement = ev.target.options[ev.target.selectedIndex];
    let privKey = adminSession.privateKey;
    let pkfp = adminSession.pkfp;
    let ic = new iCrypto();
    ic.createNonce('n').setRSAKey("pk", privKey, 'private').privateKeySign('n', 'pk', 'sign').bytesToHex('n', 'nhex');

    XHR({
        type: "POST",
        url: "/admin",
        dataType: "json",
        data: {
            action: "logger_state_change",
            nonce: ic.get('nhex'),
            state: selectedElement.value,
            sign: ic.get('sign'),
            pkfp: pkfp

        },
        success: () => {
            let message = "Logger has been successfully " + (selectedElement.value === "true" ? "enabled" : "disabled");
            toastr.info(message);
        },
        err: err => {
            toastr.warning("Error loading logs: " + err);
        }
    });
}

function requestLoggerLevelChange(ev) {
    let selectedElement = ev.target.options[ev.target.selectedIndex];
    let privKey = adminSession.privateKey;
    let pkfp = adminSession.pkfp;
    let ic = new iCrypto();
    ic.createNonce('n').setRSAKey("pk", privKey, 'private').privateKeySign('n', 'pk', 'sign').bytesToHex('n', 'nhex');

    XHR({
        type: "POST",
        url: "/admin",
        dataType: "json",
        data: {
            action: "log_level_change",
            nonce: ic.get('nhex'),
            level: selectedElement.value,
            sign: ic.get('sign'),
            pkfp: pkfp

        },
        success: () => {
            toastr.info("Log level has been changed to: " + selectedElement.value);
        },
        error: err => {
            toastr.warning("Error loading logs: " + err);
        }
    });
}

function prepareLogPageListeners() {
    util.$("#load-logs").addEventListener("click", () => {
        loadLogs();
    });

    util.$("#load-error-logs").addEventListener("click", () => {
        loadLogs(true);
    });

    util.$("#logs-state").addEventListener("change", requestLoggerStateChange);
    util.$("#log-highest-level").addEventListener("change", requestLoggerLevelChange);
}

function reverseLogList() {

    for (let i = 0; i < logTableBody.childNodes.length; i++) {
        logTableBody.insertBefore(logTableBody.childNodes[i], logTableBody.firstChild);
    }
}

function filterLogs(ev) {
    let filter;
    try {
        filter = new RegExp(ev.target.value);
        if (!filter || filter.length === 0) {
            return;
        }
    } catch (err) {
        return;
    }

    for (let i = 0; i < logTableBody.childNodes.length; i++) {

        let selectedField = parseInt(filterFieldSelector.options[filterFieldSelector.selectedIndex].value);
        let row = logTableBody.childNodes[i];
        let testingField;
        if (!isNaN(selectedField)) {
            testingField = row.children[selectedField] ? row.children[selectedField].innerHTML : "";
        } else {
            testingField = row.innerHTML;
        }
        filter.test(testingField) ? logTableBody.childNodes[i].classList.remove("log-row-hidden") : logTableBody.childNodes[i].classList.add("log-row-hidden");
    }
}

function clearLogs(ev) {
    let privKey = adminSession.privateKey;
    let pkfp = adminSession.pkfp;
    let ic = new iCrypto();
    ic.createNonce('n').setRSAKey("pk", privKey, 'private').privateKeySign('n', 'pk', 'sign').bytesToHex('n', 'nhex');

    XHR({
        type: "POST",
        url: "/admin",
        dataType: "json",
        data: {
            action: "clear_logs",
            nonce: ic.get('nhex'),
            sign: ic.get('sign'),
            pkfp: pkfp
        },
        success: () => {
            logTableBody.innerHTML = "";
            toastr.info("Log level have been cleared");
        },
        error: err => {
            toastr.warning("Error clearing logs: " + err);
        }
    });
}


function prepareRequestProcessor(adminSession){
    return function (data, onSuccess, onError){
        if (!data.action){
            throw new Error("Malformed request")
        }
        let privKey = adminSession.privateKey;
        let pkfp = adminSession.pkfp;
        let ic = new iCrypto();
        ic.createNonce("n")
            .bytesToHex("n", "nhex");
        data.nonce = ic.get("nhex");
        let requestString = JSON.stringify(data);
        ic.addBlob('data', requestString)
            .setRSAKey("pk", privKey, 'private')
            .privateKeySign('data', 'pk', 'sign');
        XHR({
            type: "POST",
            url: "/admin",
            dataType: "json",
            data: {
                action: data.action,
                requestString: requestString,
                sign: ic.get('sign'),
                pkfp: pkfp
            },
            success: onSuccess,
            error: onError
        });
    };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Direct updates are not currently used


// function switchUpdateMode() {
//
//    if ($('#update-from-file').prop('checked')) {
//        $('#update-from-file--wrapper').css("display", "block");
//        $('#update-from-git--wrapper').hide();
//        $('#github-update-options--wrap').hide();
//    } else {
//        $('#update-from-file--wrapper').hide();
//        $('#update-from-git--wrapper').css("display", "block");
//        $('#github-update-options--wrap').css("display", "block");
//    }
//}
//
//
//function processUpdateFile() {
//    let file = util.$("#update-file").files[0];
//    getUpdateFileData(file).then(filedata => {
//        let signature = signUpdateFile(filedata);
//        util.$("#pkfp").value = adminSession.pkfp;
//        util.$("#sign").value = signature;
//        util.$("#select-file").innerText = "SELECTED: " + file.name;
//    }).catch(err => {
//        throw err;
//    });
//}
//
//function launchUpdate() {
//    if ($('#update-from-file').hasClass('active') && util.$("#update-file").value) {
//        loadingOn();
//        updateFromFile();
//    } else if ($('#update-from-git').hasClass('active')) {
//        console.log("Updating from GIT");
//        loadingOn();
//        updateFromGithub();
//    } else {
//        toastr.warning("Please select the update file!");
//    }
//}
//
//function updateFromFile() {
//    let file = util.$("#update-file").files[0];
//    getUpdateFileData(file).then(filedata => {
//        let signature = signUpdateFile(filedata);
//        sendUpdateFromFileRequest(file, signature);
//    }).catch(err => {
//        throw err;
//    });
//}
//
//function getUpdateFileData(file) {
//    return new Promise((resolve, reject) => {
//        try {
//            let reader = new FileReader();
//
//            reader.onload = () => {
//                resolve(reader.result);
//            };
//            reader.readAsBinaryString(file);
//        } catch (err) {
//            reject(err);
//        }
//    });
//}
//
//
//function signUpdateFile(filedata) {
//    let ic = new iCrypto();
//    ic.setRSAKey("pk", adminSession.privateKey, "private").addBlob("f", filedata).privateKeySign("f", "pk", "sign");
//    return ic.get("sign");
//}
//
//function getSelectedUpdateBranch() {
//    let branchSelect = util.$("#gh-update-branch-select");
//    return branchSelect.options[branchSelect.options.selectedIndex].value;
//}
//
//function updateFromGithub() {
//    let ic = new iCrypto();
//
//    ic.setRSAKey("pk", adminSession.privateKey, "private").createNonce("n").bytesToHex("n", "nhex").privateKeySign("n", "pk", "sign");
//    let data = new FormData();
//    data.append("action", "update_from_github");
//    data.append("branch", getSelectedUpdateBranch());
//    data.append("pkfp", adminSession.pkfp);
//    data.append("nonce", ic.get("nhex"));
//    data.append("sign", ic.get("sign"));
//    sendUpdateRequest(data);
//}
//
//function sendUpdateFromFileRequest(filedata, signature) {
//    let data = new FormData();
//    data.append("action", "update_from_file");
//    data.append("pkfp", adminSession.pkfp);
//    data.append("file", util.$("#update-file").files[0]);
//    data.append("sign", signature);
//
//    sendUpdateRequest(data);
//}
//
//function sendUpdateRequest(data) {
//    let request = new XMLHttpRequest();
//    request.open("POST", window.location.href, true);
//    request.send(data);
//    request.onreadystatechange = () => {
//        if (request.readyState === XMLHttpRequest.DONE) {
//            //
//            console.log("Handling response");
//            loadingOff();
//            if (request.status === 200) {
//                $('#close-code-view').hide();
//                showModalNotification("Update completed", "<span id=timer>You will be redirected in 5 seconds</span>");
//                delayedPageReload(5);
//            } else {
//                toastr.warning("Update failed: " + request.responseText);
//            }
//        }
//    };
//}

//
//function switchUpdateOption(event) {
//    if ($(event.target).hasClass("active")) {
//        return;
//    }
//
//    util.$$(".update-option").forEach((el) => {
//        if (!$(el).hasClass("active") && $(el).attr("id") === "update-from-file") {
//            $("#update-file--wrapper").css("display", "flex");
//        } else if ($(el).hasClass("active") && $(el).attr("id") === "update-from-file") {
//            $("#update-file--wrapper").css("display", "none");
//        }
//        $(el).toggleClass("active");
//    });
//}
//
