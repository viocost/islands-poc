import { ChatClient } from  "./chat/ChatClient";
import toastr from "./lib/toastr";
import { Vault } from "./lib/Vault";
import { iCrypto } from "./lib/iCrypto";
import * as Modal from "./lib/DynmaicModal";
import { verifyPassword } from "./lib/PasswordVerify";
import * as dropdown from "./lib/dropdown";
import * as editable_field from "./lib/editable_field";
import * as util from "./lib/dom-util";
import { BlockingSpinner } from "./lib/BlockingSpinner";
import { XHR } from "./lib/xhr";
import '../css/main.sass';
const sjcl = require("sjcl");


let vault;
let reg = isRegistration();
let topicCreateForm;
let topicJoinForm;
let passwordChangeForm;

///Functions closures
let reloadVault;
let adminLogin;

let spinner = new BlockingSpinner();
//TEST only
window.util = util;
window.spinner = spinner;
window.BlockingSpinner = BlockingSpinner;




/**Set main listeneres when document loaded**/
document.addEventListener('DOMContentLoaded', event => {
    window.sjcl = sjcl;
    document.title = "Login | Islands";
    util.$("#register-vault").addEventListener("click", registerVault);
    util.$("#vault-login-btn").addEventListener("click", vaultLoginGetVault);
    util.$("#create").addEventListener("click", showTopicCreateForm);
    util.$("#join").addEventListener("click", showTopicJopinForm);
    util.$("#change-pass").addEventListener("click", showChangPasswordForm);

    if (reg){
        setView("register")
        util.$('#vault-new-password-confirm').onkeypress = e => {
            if (e.keyCode === 13) {
                registerVault();
            }
        };
    } else {
        //regular login
        setView("login");
        util.$('#vault-password').onkeypress = e => {
            if (e.keyCode === 13) {
                vaultLoginGetVault();
            }
        };
    }
    document.querySelector("#vault-login-btn").addEventListener("click", vaultLoginGetVault);
    prepareTopicJoinModal();
    prepareTopicCreateModal();
    prepareChangePasswordModal();

});

function isMobile(){
    return isMobileIOS() ||
        navigator.userAgent.match(/Android/i) ||
        navigator.userAgent.match(/webOS/i) ||
        navigator.userAgent.match(/BlackBerry/i) ||
        navigator.userAgent.match(/Windows Phone/i)
}

function isMobileIOS(){
    return navigator.userAgent.match(/iPhone/i)   ||
        navigator.userAgent.match(/iPad/i)  ||
        navigator.userAgent.match(/iPod/i)   
}

function prepareChangePasswordModal(){
    let wrapper = util.bake("div");

    let oldPass = util.bake("input", {
        id: "pass-change-old",
        classes: "left-align",
        attributes:{
	    maxlength: "50",
            type: "password",
            placeholder: "Enter old password",
            required: true
        }

    });

    let newPass = util.bake("input", {
        id: "pass-change-new",
        classes: "left-align",
        attributes:{
            type: "password",
	    maxlength: "50",
            placeholder: "Enter new password",
            required: true
        }

    });

    let confirm = util.bake("input", {
        id: "pass-change-confirm",
        classes: "left-align",
        attributes:{
            type: "password",
	    maxlength: "50",
            placeholder: "Confirm new password",
            required: true
        }

    });

    let clearFields = ()=>{
        oldPass.value = "";
        newPass.value = "";
        confirm.value = "";
    };

    wrapper.addEventListener("keypress", (ev)=>{
        if (ev.which === 13 || ev.keyCode === 13) {
            changePassword();
        }
    });

    util.appendChildren(wrapper, [oldPass, newPass, confirm]);
    passwordChangeForm = Modal.prepareModal(wrapper, {closeMethods: ["button"], onOpen: clearFields, onClose: clearFields});
    passwordChangeForm.addFooterBtn('Change password!', 'tingle-btn tingle-btn--primary tingle-btn--pull-right', changePassword);
}


function prepareTopicCreateModal(){
    let wrapper = util.bake("div");
    let topicName = util.bake("input", {
        id: "new-topic-name",
        classes: "left-align",
        attributes:{
            placeholder: "Enter topic name",
	    maxlength: "255",
            required: true
        }

    });

    let nickname = util.bake("input", {
        id: "new-topic-nickname",
        classes: "left-align",
        attributes: {
            placeholder: "Enter nickname",
	    maxlength: "255", 
            required: true
        }
    });

    let clearFields = ()=>{
        nickname.value = "";
        topicName.value = ""
    };

    let start = ()=>{
        if (topicName.value.trim() === ""){
            toastr.warning("Topic name is required!")
        } else if (nickname.value.trim() === ""){
            toastr.warning("Nickname is required!")
        } else{
            topicCreate();
        }
    };

    wrapper.addEventListener("keypress", (ev)=>{
        if (ev.which === 13 || ev.keyCode === 13) {
            start();
        }
    });

    util.appendChildren(wrapper, [topicName, nickname]);
    topicCreateForm = Modal.prepareModal(wrapper, {closeMethods: ["button"], onOpen: clearFields, onClose: clearFields});
    topicCreateForm.addFooterBtn('Create topic!', 'tingle-btn tingle-btn--primary tingle-btn--pull-right', start);
}

function prepareTopicJoinModal(){
    let wrapper = util.bake("div")
    let title = util.bake("h3", {
        text: "Join existing topic"
    });

    let nickname = util.bake("input", {
        id: "join-nickname",
        classes: "left-align",
        attributes: {
            placeholder: "Enter your nickname",
	    maxlength: "255",
            required: true
        }
    });

    let inviteCode = util.bake("input", {
        id: "join-topic-invite",
        classes: "left-align",
        attributes: {
            placeholder: "Paste invite code",
	    maxlength: "255",
            required: true
        }
    });

    let clearFields = ()=>{
        nickname.value = "";
        inviteCode.value = "";
        topicName.value = ""
    };

    let topicName = util.bake("input", {
        id: "join-topic-name",
        classes: "left-align",
        attributes: {
            placeholder: "Enter topic name",
	    maxlength: "255",
            required: true
        }
    });

    util.appendChildren(wrapper, [title, nickname, inviteCode, topicName]);
    topicJoinForm = Modal.prepareModal(wrapper, {closeMethods: ["button"], onOpen: clearFields, onClose: clearFields});

    let start = ()=>{
        //Checking if all required fields are filled
        if(inviteCode.value.trim() === ""){
            toastr.warning("Invite code is required!")
        }else if(nickname.value.trim() === ""){
            toastr.warning("Nickname is required!")
        }else if(topicName.value.trim() === ""){
            toastr.warning("Topic name is required!")
        }else{
            topicJoin();
        }
    };

    wrapper.addEventListener("keypress", (ev)=>{
        if (ev.which === 13 || ev.keyCode === 13) {
            start();
        }
    });

    topicJoinForm.addFooterBtn('Join topic!', 'tingle-btn tingle-btn--primary tingle-btn--pull-right', start);

}

/**Handlers **/
function registerVault() {
    return new Promise((resolve, reject) => {
        try{
            loadingOn();
            let password = util.$("#vault-new-password");
            let confirm =  util.$("#vault-new-password-confirm");
            let result = verifyPassword(password.value.trim(), confirm.value.trim());
            if(result !== undefined ){
                toastr.warning(result);
                loadingOff();
                return
            }
            let ic = new iCrypto();
            ic.generateRSAKeyPair("adminkp")
                .createNonce("n")
                .privateKeySign("n", "adminkp", "sign")
                .bytesToHex("n", "nhex");

            let vault = new Vault();
            vault.init(password.value.trim());
            let vaultEncData = vault.pack();
            let vaultPublicKey = vault.publicKey;

            XHR({
                type: "POST",
                url: "/register",
                dataType: "json",
                data: {
                    nonce: ic.get('nhex'),
                    sign: ic.get("sign"),
                    vault: vaultEncData.vault,
                    vaultPublicKey: vaultPublicKey,
                    vaultSign: vaultEncData.sign
                },
                success: () => {
                    util.displayNone(" #vault-register--wrapper");
                    util.displayFlex(" #registration-complete--wrapper");
                    password.value = "";
                    confirm.value = "";

                    loadingOff();
                    toastr.success("Registration complete!");
                    resolve();
                },
                error: err => {
                    loadingOff();
                    toastr.error("error registring");
                    reject("Fail!" + err);
                }
            });
        }catch (err){
            toastr.warning(err);
            loadingOff();
            reject(err)
        }

    })
}


function fillIDFromParameters(){
    console.log("Filling id from parameters")
    let url = new URL(document.location.href);
    console.log("Got url: " + url)
    let vaultID = url.searchParams.get("vault_id");
    console.log("Vault id: " + vaultID)
    if (vaultID){
        document.querySelector("#vault-id-login").value = vaultID;
    }
}


/** Vault login sequence */
function vaultLoginGetVault(ev){
    //give vault id
    try{
        let passwordEl = document.querySelector("#vault-password")
        let password = passwordEl.value;
        if(!password){
            toastr.warning("Error: missing password!");
            return;
        }
        loadingOn()
        XHR({
            type: "post",
            url: "/",
            success: (data)=>{
                vaultLoginProcessVault(data, password, passwordEl)
            },
            error: err => {
                loadingOff();
                toastr.warning(err.responseText);
            }
        });
    }catch(err){
        loadingOff();
        toastr.warning("Login failed. Check the password and try again.")
        console.log(err)

    }
}

function vaultLoginProcessVault(data, password, passwordEl){
    try{
        console.log("Vault obtained. Continuing login...");
        vault = new Vault();
        if(typeof data === "string"){
            console.log("Data seems to be string. Parsing...")
            data = JSON.parse(data)
        }

        vault.initSaved(data.vault, password);
        initPasswordBasedHandlers(password);
        passwordEl.value = "";
        vaultLoginFinalize();
        document.title = "Vault | Islands"
    }catch(err){
        loadingOff();
        toastr.warning("Login failed. Check the password and try again.")
        console.log(err)
    }
}

function vaultLoginFinalize(){
    loadingOff();
    setView("online");
    renderVault();
    toastr.success("Login successful");
}
/** END */

function showTopicJopinForm(){

    topicJoinForm.open();
}

function topicJoin(){
    try{
        loadingOn();
        let nickname = document.querySelector("#join-nickname").value;
        let inviteCode = document.querySelector("#join-topic-invite").value;
        let topicName = document.querySelector("#join-topic-name").value;

        let transport = isMobileIOS() ? 0 : 1;
        let chat = new ChatClient({version: version, transport: transport});

        chat.on("topic_join_success", async (data)=>{
            console.log("Topic join successful!");
            vault.addTopic(data.pkfp, topicName, data.privateKey);
            await saveVault();
            renderVault();
            loadingOff();
            toastr.info("Topic has been created!");
            _destroyChat(chat);
            topicJoinForm.close();
        });

        chat.on("topic_join_error",  (err)=>{
            console.log("Topic join finished with error: " + err);
            loadingOff();
            toastr.warning("Topic join finished with error: " + err);
            _destroyChat(chat);

        });

        chat.initTopicJoin(nickname, inviteCode)
            .then(()=>{
                console.log("Topic creation initiated!: ");
            })
            .catch(err=>{
                console.log("Error creating topic: " + err );
                loadingOff();
                topicJoinForm.close();
            })

    }catch(err){
        loadingOff();
        toastr.warning("Error joining topic: "  + err);
    }
}

function showTopicCreateForm() {
    topicCreateForm.open()
}


function showChangPasswordForm(){
    passwordChangeForm.open();
}


/**Change topic alias*/

function setTopicAlias(ev){
    let newAlias = ev.target.value;
}

/**Change passsword sequence */
function changePassword(){
    loadingOn();
    let old = util.$("#pass-change-old");
    let newPass = util.$("#pass-change-new");
    let passConfirm = util.$("#pass-change-confirm");

    let result = verifyPassword(newPass.value.trim(), passConfirm.value.trim());
    if(result !== undefined ){
        toastr.warning(result);
        loadingOff();
        return
    } else if(old.value === newPass.value){
        toastr.warning("New password and old password are the same");
        loadingOff();
        return
    }

    try{
        XHR({
            type: "post",
            url: "/",
            success: async (data)=>{
                await changePasswordProcess(data, old, newPass);
            },
            error: err => {
                loadingOff();
                toastr.warning(err.responseText);
                console.log("Vault login error: " + err.responseText);
            }
        });
    }catch(err){
        loadingOff();
        toastr.warning("Login failed. Check the password and try again.")
        console.log(err)

    }

}

async function changePasswordProcess(data, old, newPass){
    try{
        vault = new Vault();
        console.log("Vault obtained")
        vault.initSaved(data.vault, old.value);
        console.log("Vault decrypted")
        vault.changePassword(newPass.value);
        initPasswordBasedHandlers(newPass.value)
        await saveVault();
        renderVault();
        toastr.success("Password has been changed")
        passwordChangeForm.close()
        loadingOff();
    }catch(err){
        loadingOff();
        toastr.warning("Password change failed: " + err.message);
        console.log(err.message);
    }

}
/** END */

function topicCreate(){
    loadingOn();
    let nickname = document.querySelector("#new-topic-nickname").value;
    let topicName = document.querySelector("#new-topic-name").value;

    let transport = isMobileIOS() ? 0 : 1;
    let chat = new ChatClient({version: version, transport: transport});

    chat.on("init_topic_success", async (data)=>{
        console.log("Topic Created!");
        vault.addTopic(data.pkfp, topicName, data.privateKey);
        await saveVault();
        renderVault();
        loadingOff();
        topicCreateForm.close()
        _destroyChat(chat);
        toastr.info("Topic has been created!")
    });

    chat.initTopic(nickname, topicName)
        .then(()=>{
            console.log("Topic creation initiated!: ");

        })
        .catch(err=>{
            console.log("Error creating topic: " + err );
            topicCreateForm.close()
        })
}

function _destroyChat(chat){
    chat.logout();
    chat.off();
    chat = null;
}


/**
 *
 * @param options
 *  privateKey - topic private key
 *  currentWindow - boolean Option to login in current window
 * @returns {result}
 */
function prepareLogin(options){

    let privateKey = options.privateKey;
    let isMobile = options.isMobile;
    return function (){
        let ic = new iCrypto();
        ic.addBlob("privk", privateKey)
            .createSYMKey("sym")
            .AESEncrypt("privk", "sym", "privkcipher")
            .createNonce("id", 16)
            .bytesToHex("id", "idhex");

        localStorage.setItem(ic.get("idhex"), ic.get("privkcipher"));

        let params = "?id=" + ic.get("idhex") + "&token=" + ic.get("sym");
        if(options.currentWindow){
            window.open(document.location.href + "chat" + params, "_self");
        }else{
            window.open(document.location.href + "chat" + params, isMobile ? "_self" : "_blank");
        }
    };

}





/*VIEWS SETTINGS*/

function setView(view){

    console.log("Vault: setting view: " + view );
    let setters = {
        login: setViewLogin,
        register: setViewRegister,
        online: setViewOnline
    };

    if(!setters.hasOwnProperty(view)){
        throw new Error("Invalid view");
    }
    setters[view]();
}



function setViewLogin(){

    document.querySelector("#vault-content--wrapper").style.display= "none";
    document.querySelector("#vault-login--wrapper").style.display ="flex";
    document.querySelector("#vault-register--wrapper").style.display  = "none"
}

function setViewRegister(){


    document.querySelector("#vault-content--wrapper").style.display= "none";
    document.querySelector("#vault-login--wrapper").style.display ="none";
    document.querySelector("#vault-register--wrapper").style.display  = "flex"
}

function setViewOnline(){

    document.querySelector("#vault-content--wrapper").style.display= "flex";
    document.querySelector("#vault-login--wrapper").style.display ="none";
    document.querySelector("#vault-register--wrapper").style.display  = "none"
}

function saveVault(){
    return new Promise((resolve, reject)=>{
        let vaultEncData = vault.pack();
        XHR({
            type: "POST",
            url: "/update",
            dataType: "json",
            data: vaultEncData,

            success: (data)=>{
                console.log("Vault updated");
                reloadVault(data);
                resolve(data)
            },

            error: (err)=>{
                toastr.warning(err.responseText)
                console.log("Vault update error: " + err.responseText);
                reject(err)
            }

        })
    })
}



function renderVault(){
    let topics = document.querySelector("#user-topics");
    topics.innerHTML = "";
    for(let k in vault.topics){
        if(!vault.topics.hasOwnProperty(k)){
            console.log("Invalid topic record");
            continue
        }
        let topicContainer = util.bake("div", {classes: "topic-container"});
        let nameElement  = editable_field.bakeEditableField("Topic alias", "topic-title");
        nameElement.value = vault.topics[k].name;
        addNameChangeHandlers(nameElement);
        let idWrap = util.bake("div", {classes: "topic-id-wrap"});
        let idHeading = util.bake("span", {text: "ID: "});
        let topicId = util.bake("span", {text: vault.topics[k].pkfp, classes: "topic-id"});
        idWrap.addEventListener("click", ()=>{
            copyTextToBuffer(topicId.innerText, "Topic ID has been copied to clipboard");
        });
        util.appendChildren(idWrap, [idHeading, topicId]);

        let buttons = util.bake("div", {classes: "topic-buttons"});
        let loginButton = util.bake("button", {classes: "login-button", text: "Login"});
        loginButton.addEventListener("click", prepareLogin({privateKey: vault.topics[k].key, isMobile: isMobile()}));
        let options = bakeTopicDropdownMenu(vault.topics[k].key, vault.topics[k].pkfp);

        util.appendChildren(buttons, [loginButton, options]);
        util.appendChildren(topicContainer, [ nameElement, idWrap, buttons]);
        util.appendChildren(topics, topicContainer);
    }

    if(vault.admin){
        adminLogin = prepareAdminLogin(vault.adminKey);
        let oldButton = document.querySelector("#admin");
        let newButton = oldButton.cloneNode(true);
        oldButton.parentNode.replaceChild(newButton, oldButton);
        newButton.addEventListener("click", adminLogin);
        newButton.style.display = "block";
    } else {
        document.querySelector("#admin").style.display = "none";
    }
    console.log("Checking if topics exist...")
    console.log(vault.topics.toString())
    if (Object.keys(vault.topics).length == 0){
	console.log("No topics found. Showing welcome message.")
	util.$("#welcome-msg-wrap").style.display = "block"
    } else {
	console.log("Topics exist")
	util.$("#welcome-msg-wrap").style.display = "none"
    }
}

function addNameChangeHandlers(el){
    el.addEventListener("change", processTopicNameChange)
    el.addEventListener("keypress", (ev)=>{
        if (ev.which === 13 || ev.keyCode === 13) {
            document.activeElement.blur();
        }
    })
}

function bakeTopicDropdownMenu(key, pkfp){
    return dropdown.bakeDropdownMenu("Options", {
        "Login in this window": prepareLogin({privateKey: key, currentWindow: true}),
        "Delete permanently": prepareTopicDelete(key, pkfp),
        "Delete topic record": ()=>{
            let _deleteRecord = prepareTopicRecordDelete(pkfp);
            _deleteRecord()
                .then(()=>{
                    renderVault()
                })
                .catch(err =>{throw err})
        }
    })
}

function prepareTopicRecordDelete(pkfp){
    return ()=>{
        return new Promise(async (resolve, reject)=>{
            try{
                delete vault.topics[pkfp];
                await saveVault();
                resolve();
            }catch(err){
                reject(err);
            }
        })
    }
}

function prepareTopicDelete(privateKey, pkfp){
    return  (ev)=>{
        if(!confirm("Topic will be permanently deleted. \n\nProceed?")) {
            return
        }

        let onError = err =>{
            loadingOff();
            toastr.warning(err.responseText);
            console.log("Vault login error: " + err.responseText);
        };
        let transport = isMobileIOS() ? 0 : 1;
        let chat = new ChatClient({version: version, tranport: transport});

        let deleteTopicRecord = prepareTopicRecordDelete(pkfp);

        chat.on("login_success", async ()=>{
            console.log("Deleting topic in chat");
            await chat.deleteTopic();
        });

        chat.on("delete_topic_success", async()=>{
            try{
                await deleteTopicRecord();
                renderVault();
                _destroyChat(chat);
                toastr.success("Topic has been deleted!");
                loadingOff();
            }catch(err){
                onError(err);
            }
        });

        chat.on("login_error", onError);
        chat.on("delete_topic_error", onError);
        console.log("Logging into chat");
        chat.topicLogin(privateKey)
            .then(()=>{
                console.log("Topic login successfull for deleteion")
            })
            .catch(onError);
    }
}



function processTopicNameChange(ev){
    try{
        let pkfp = ev.target.parentElement.children[1].children[1].innerText;
        vault.topics[pkfp].setName(ev.target.value);
        saveVault()
            .then(()=>{
                toastr.info("Topic alias updated");
            })
            .catch(err=>{
                toastr.warning("Error updating topic alias: " + err)
            })

    }catch(err){
        toastr.warning("Error updating topic alias: " + err)
    }

}


function prepareAdminLogin(privateKey){
    let isMobile = isMobileIOS()
    return  function (){
        let ic = new iCrypto();
        ic.addBlob("privk", privateKey)
            .createSYMKey("sym")
            .AESEncrypt("privk", "sym", "privkcipher")
            .createNonce("id", 16)
            .bytesToHex("id", "idhex");
        //Save it in a local storage
        localStorage.setItem(ic.get("idhex"), ic.get("privkcipher"));

        let params = "?id=" + ic.get("idhex") + "&token=" + ic.get("sym");

        window.open(document.location.href + "admin" + params, isMobile ? undefined : "_blank");
    };
}



function loadingOn() {
    spinner.loadingOn()
}

function loadingOff() {
    spinner.loadingOff()
}




function initPasswordBasedHandlers(password){
    reloadVault = function (data){
        if(!password){
            toastr.warning("Error: missing password!");
            return;
        }
        vault = new Vault();
        vault.initSaved(data.vault, password);
    }
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


