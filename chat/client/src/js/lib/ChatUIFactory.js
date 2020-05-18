import * as util from "./dom-util"
import * as Modal from "./DynmaicModal";
import { IError as Err } from "../../../../common/IError";

//Bakes select list for side panel
// top boolean whether it is select for top block
export function bakeCarousel(){
    let options = []
    options.push(util.bake("option", {text: "Topics"}))

    return util.bake("div", {
        class: "carousel-wrap",
        children: [

            util.bake("div", {
                id: `btn-rotate`,
                class: ["arrow", "left", "btn-rotate"]
            }),

            util.bake("select", {
                class: "carousel",
                id: `carousel`,
                children: options,
                listeners: {
                    "mousedown": (e)=>{
                        e.preventDefault();
                        window.focus();
                    }
                }
            }),

            util.bake("div", {
                id: `btn-rotate`,
                class: ["arrow", "right", "btn-rotate"]
            })

        ]
    })

}



export function bakeSidePanel(version = Err.required("Version")){
    let carousel = bakeCarousel()
    return util.bake("div", {
        class: "side-panel-container",
        children: [
            util.bake("div", {
                class: ["side-panel-wrapper"],

                id: "side-panel-wrapper",
                children: [
                    carousel,
                    //topics block
                    util.bake("div", {
                        class: "side-block-wrap",
                        children: [
                            //topics block
                            bakeTopicsBlock(),
                        ]
                    })
                ]
            }),


            util.bake("div", {
                class: "version-wrapper",
                children: [
                    util.bake("img", {
                        class: "logo",
                        attributes: {
                            src:  "/img/island.svg"
                        }
                    }),
                    util.bake("h3", {
                        text: `Islands Release v${version}`
                    })
                ]
            })
        ]
    })
}


// Bakes empty  topics block for side panel
function bakeTopicsBlock(){

    return  util.bake("div", {
        class: "side-panel-block",
        id: `topic-block`,
       
        children: [
            //Top buttons
            util.bake("div", {
                class:  [ "side-panel-button-row", "btn-top-row" ],
                children: [

                    util.bake("button", {
                        //New topic button
                        id: `btn-new-topic`,
                        class: ["side-panel-btn", "btn", "btn-top"],
                        text: "New topic",
                    }),

                    util.bake("button", {
                        //Join button
                        id: `btn-join-topic`,
                        class: ["side-panel-btn", "btn", "btn-top"],
                        text: "Join topic",
                    }),

                ]
            }),

            //No topic label
            util.bake("h4", {
                class: "empty-block",
                text: "No topics yet",
                style: "display: none"
            }),

            //List of existing topics
            util.bake("ul", {
                class: "side-block-data-list",
                id: `topics-list`,
            }),

            //Context button menu bottom
            util.bake("div", {
                class: "ctx-bottom-menu-wrap",
                children: [
                    util.bake("div", {
                        class: "ctx-topic-buttons",
                        children: [
                            util.bake("button", {
                                text: "Alias",
                                style: "display: none",
                                class: "btn",
                                id: "btn-ctx-alias",
                            }),
                            util.bake("button", {
                                text: "Invite",
                                style: "display: none",
                                class: "btn",
                                id: "btn-ctx-invite"

                            }),

                            util.bake("button", {
                                text: "Mute",
                                class: "btn",
                                style: "display: none",
                                id: "btn-ctx-mute"

                            }),

                            util.bake("button", {
                                text: "Leave",
                                class: "btn",
                                style: "display: none",
                                id: "btn-ctx-leave"

                            }),

                            util.bake("button", {
                                text: "Delete",
                                class: "btn",
                                style: "display: none",
                                id: "btn-ctx-delete"

                            }),

                            util.bake("button", {
                                text: "Boot",
                                class: "btn",
                                style: "display: none",
                                id: "btn-ctx-boot"

                            }),
                        ]
                    }),

                ]
            })
        ]
    })
}


export function bakeParticipantListItem(data){
    let { nickname, pkfp, alias, onClick, onDClick, isSelf } = data;
    let iconClasses = ["participant-icon", ]

    if(isSelf){
        iconClasses.push("that-is-me");
    }

    return util.bake("div", {
        class: "participant-list-item",
        listeners: {
            click: onClick,
            dblclick: onDClick
        },
        attributes: {
            pkfp: pkfp
        },
        children: [
            util.bake("div", {
                class: iconClasses
            }),

            util.bake("div", {
                class: "participant-label",
                children: [

                    util.bake("span", {
                        text: isSelf ? "(me)" : alias ? alias : `${pkfp.substring(0, 8)}`
                    }),

                    util.bake("span", {
                        text: "--"
                    }),

                    util.bake("span", {
                        text: nickname
                    }),
                ]
                //html: alias ? `${nickname} -- ${alias}` : `${nickname} -- ${nickname}`
            })
        ]
    })
}

export function bakeInviteListItem(inviteCode, onclick, onDoubleClick, alias=""){
    return util.bake("div", {
        attributes: {
            "code": inviteCode
        },
        listeners: {
            click: onclick,
            dblclick: onDoubleClick
        },
        class: "invite-list-item",
        children: [
            util.bake("div", {
                class: "invite-icon"
            }),
            util.bake("div", {
                class: "invite-label",
                html: `Invite ${alias ? alias : inviteCode.substring(117, 147)}`
            })

        ],
        //////////////////////////
        // listeners: {         //
        //     "click": onclick //
        // },                   //
        //////////////////////////
        //
        //html: inviteCode.substr(117, )
    })
}

export function bakeMessagesPanel(newMsgBlock){
    return util.bake("div", {
        class: "main-panel-container",
        children: [
            util.bake("div", {
                class: "messages-panel-container",
                id: "messages-panel-container",
                children: [
                    util.bake("h4", {
                        id: "topic-in-focus-label",
                        class: "topic-in-focus-label"
                    }),

                    util.bake("div", {
                        class: "messages-window",
                        id: "messages-window-1"
                    })


                ],
            }),
            newMsgBlock
        ]
    })
}

export function bakeNewMessageControl(sendHandler = Err.required("sendMessage handler"),
                                      attachmentChosenHandler = Err.required("attachmentChosen handler")){
    return util.bake("div", {
        id: "new-message-container",
        children: [
            util.bake("div", {
                class: ["control-col", "new-msg-input"],
                children: [
                    util.bake("div", {
                        class: "private-label",
                        id: "private-label",
                        children: [
                            util.bake("img", {
                                attributes:{
                                    id: "remove-private",
                                    src: "/img/close.png"
                                },

                            }),
                            util.bake("span", {
                                text: "Prvate to: "
                            }),
                            util.bake("span")

                        ]
                    }),
                    util.bake("div", {
                        class: "input-wrap",
                        children: [
                            util.bake("div", {
                                class: "button-column",
                                children: [
                                    util.bake("img", {
                                        src: "/img/spinner.gif",
                                        class: "uploading-animation",
                                        id: "uploading-animation"
                                    }),
                                    util.bake("label", {
                                        id: "attach-file-button",
                                        attributes: {
                                            for: "attach-file"
                                        },
                                        children: [
                                            util.bake("img", {
                                                attributes: {
                                                    src: "/img/clip.svg"
                                                }
                                            })
                                        ]
                                    })
                                ]
                            }),
                            util.bake("div", {
                                class: ["flex-column", "new-msg-input"],
                                children: [
                                    util.bake("textarea", {
                                        id: "new-msg",
                                        attributes: {
                                            placeholder: "Enter your message. Ctrl+Enter - new line. Enter - send."
                                        }
                                    }),
                                    util.bake("div", {
                                        id: "chosen-files"
                                    })
                                ]
                            })
                        ]
                    }),

                    util.bake("div", {
                        id: "chosen-files"
                    })
                ]
            }),

            // New message button block
            util.bake("div", {
                class: ["control-col", "new-msg-buttons"],
                children: [
                    util.bake("div", {
                        class: "send-button-wrap",
                        children: [
                            util.bake("button", {
                                id: "send-new-msg",
                                class: "btn-send",
                                text: "SEND",
                                listeners: {
                                    click: sendHandler
                                }
                            })
                        ]
                    }),
                    util.bake("input", {
                        id: "attach-file",
                        class: "inputfile",
                        attributes: {
                            type: "file",
                            name: "file",

                        },
                        listeners: {
                            "change": attachmentChosenHandler
                        }
                    }),
                    util.bake("input", {
                        id: "attach-file-dummy",
                        class: "attach-file-dummy",
                        attributes: {
                            type: "file",
                        },
                    })
                ]
            })

        ]

    })
}


export function bakeFileAttachmentElement(fileName = Err.required("File name"),
                                          clearAttachments = Err.required("Clear attachment handler")){
    return util.bake("div", {
        class: "chosen-file-wrap",
        children: [
            util.bake("img", {
                attributes: {
                    src: "/img/close.png"
                },
                listeners: {
                    click: clearAttachments
                }
            }),

            util.bake("div", {
                class: "chosen-file",
                text: fileName

            })
        ]
    })
}

export function bakeEphemeralMessage(timeStamp = Err.required("Timestamp"),
                                     msg = Err.required("Message")){
    return util.bake("div", {
        class: "ephemeral-msg",
        children: [
            util.bake("div", {
                class: "msg-heading",
                children: [
                    util.bake("b", {
                        text: "Islands ephemeral note"
                    }),

                    util.bake("span", {
                        class: "msg-time-stamp",
                        text: timeStamp
                    })
                ]
            }),

            util.bake("div", {
                class: "msg-body",
                html: msg
            })
        ]
    })
}

export function bakeLoginBlock(loginClickHandler){
     return  util.bake("div", {
        id: "vault-login--wrapper",
        class: "form-outer-wrapper",
        children: util.bake("div", {
            class: "form-border",
            children: [
                util.bake("h3", {html: "Vault login:"}),
                util.bake("div",  {
                    children:  util.bake("input", {
                        id: "vault-password",
                        class: "form-input",
                        attributes: {
                            type: "password",
                            placeholder: "Password",
                            maxlength: "50"
                        }
                    })
                }),
                util.bake("div", {
                    children: util.bake("button", {
                        id: "vault-login-btn",
                        class: ["btn", "form-button"],
                        text: "Login",
                        listeners: {
                            "click": loginClickHandler
                        }
                    }),
                })
            ]
        })
    })
}


export function bakeRegistrationBlock(onRegisterClick){
    return util.bake("div", {
        id: "vault-registration--wrapper",
        class: "form-outer-wrapper",
        children: util.bake("div", {
            class: "form-border",
            children: [
                util.bake("h3", {
                    text: "Create password:"
                }),
                util.bake("input", {
                    id: "new-passwd",

                    class: "form-input",
                    attributes: {
                        type: "password",
                        placeholder: "New password",
                        maxlength: "50"
                    }
                }),

                util.bake("input", {
                    id: "confirm-passwd",
                    class: "form-input",
                    attributes: {
                        type: "password",
                        placeholder: "Confirm password",
                        maxlength: "50"
                    }
                }),

                util.bake("div", {
                    class: "password-warning-wrap",
                    children: [
                        util.bake("img", {
                            src: "/img/warning.svg"
                        }),

                        util.bake("div", {
                            children: [
                                util.bake("b", {
                                    text: "Please, save your password!!!",
                                }),

                                util.bake("p", {
                                    text: "There is no password recovery. Once you lose it - it's gone forever!"

                                })
                            ]
                        })

                    ]
                }),
                util.bake("button", {
                    listeners: {
                        click: onRegisterClick
                    },
                    text: "Save",
                    class: ["btn", "form-button"],
                    id: "register-vault-btn",
                })
            ]
        })
    })
}


export function bakeRegistrationSuccessBlock(okClick){
    return util.bake("div", {
        class: "form-outer-wrapper",
        children: [
            util.bake("div", {
                class: "form-border",
                children: [
                    util.bake("h3", {
                        text: "Vault created!"
                    }),
                    util.bake("button", {
                        text: "Ok",
                        listeners: {
                            click: okClick
                        },
                        class: ["btn", "form-button"]
                    })
                ]
            })
        ]
    })
}

export function bakeLoginHeader(){
    return util.bake("div", {
        class: "header-section-left",
        children: [
            util.bake('img', {
                src: "/img/island.svg"
            }),

            util.bake("h3", {
                id: "active-title",
                text: "Welcome to Islands!"
            })
        ]
    })
}

export function bakeHeaderLeftSection(menuClickHandler){
    return util.bake("div", {
        class: "header-section-left",
        children: [
            util.bake("div", {
                id: "menu-button",
                class: "menu-on",
                listeners: {
                    "click": ()=>{menuClickHandler("#menu-button")}
                }
            }),

            util.bake("div", {
                class: "connection-indicator-container",
                children: [
                    util.bake("div", {
                        id: "connection-indicator",
                        class: [ "connection-indicator", "unknown"]
                    }),
                    util.bake("div", {
                        id: "connection-indicator-label-wrap",
                        class: "connection-indicator-label-wrap",
                        children: [
                            util.bake("h6", {

                                id: "connection-indicator-label",
                                class: "connection-indicator-label",
                                text: "Connection status unknown"
                            }),

                            util.bake("img", {
                                src: "/img/spinner.gif",
                                id: 'reconnect-spinner',
                                class: 'reconnect-spinner'

                            }),

                            util.bake("div", {
                                text: "Reconnect",
                                id: "reconnect-button",
                                class: "reconnect-button",
                            })



                        ]
                    })
                ]

            })
        ]
    })
}

export function bakeHeaderRightSection(
    isAdmin,
    isMute,
    infoHandler,
    muteHandler,
    settingsHandler,
    logoutHandler,
    adminLoginHandler
){
    let rightSection = util.bake("div", {
        class: "header-section-right",
    })

    util.appendChildren(rightSection, [

        util.bake("img", {
            id: "sound-control",
            src: isMute ? "/img/sound-off.svg" : "/img/sound-on.svg",
            listeners: {
                "click": muteHandler
            }
        }),


        util.bake("img", {
            id: "logout",
            src: "/img/logout-light.svg",
            listeners: {
                "click": logoutHandler
            }
        })
    ])
    return  rightSection
}


export function bakeMainContainer(){
    return util.bake("div", {
        id: "main-container",
        class: ["container", "tingle-content-wrapper"],
        style: "display: flex"
    })
}


export function bakeTopicListItem(topic, topicOnClick, expandOnClick){
    return util.bake("li", {
        class: "side-block-data-list-item",
        attributes: {
            pkfp: topic.pkfp
        },
        listeners: {
            click: topicOnClick
        },
        children: [
            util.bake("div", {
                class: "topic-row-wrap",
                listeners: {
                    dblclick: expandOnClick
                },
                children: [
                    util.bake("div", {
                        class: "btn-expand-topic",
                        listeners: {
                            click: expandOnClick
                        }
                    }),
                    util.bake("span", {
                        class: "topic-name",
                        text: topic.name
                    }),

                    util.bake("div", {
                        class: "unread-messages-container",
                    })
                ]
            }),
            ///////////////////////////////////////////
            // util.bake("div", {                    //
            //     class: "topic-assests-item-wrap", //
            //     children: [                       //
            //         util.bake("div", {            //
            //                                       //
            //         }),                           //
            //         util.bake("h5", {             //
            //                                       //
            //         })                            //
            //     ]                                 //
            // })                                    //
            ///////////////////////////////////////////

        ]
    })

}

export function bakeUnreadMessagesElement(num){
    return util.bake("span", {
        class: "unread-messages",
        text: num
    })
}

export function bakeSetAliasModal(okClick = Err.required("Ok handler required")){
    let clearFields = ()=>{
        let newAlias = util.$("#modal-alias-input");
        newAlias.value = "";
    };

    let wrap =  util.bake("div", {
        children: [
            util.bake("h2", {
                id: "modal-alias-title",
                text: "New alias"
            }),

            util.bake("p", {
                id: "modal-alias-for-label",
                class: "modal-alias-for-label"
            }),
            util.bake("input", {
                id: "modal-alias-input",
                class: "left-align",
                attributes:{
                    placeholder: "Enter new alias",
                    maxlength: "40",
                    required: true
                }
            }),

        ]
    })

    let form  = Modal.prepareModal(wrap, {
        closeMethods: ["button"],
        onOpen: clearFields,
        onClose: clearFields
    })

    form.addFooterBtn('Ok',
                      'tingle-btn tingle-btn--primary tingle-btn--pull-right',
                      okClick);
    return form
}

export function bakeTopicCreateModal(createClick){

    let clearFields = ()=>{
        let nickname = util.$("#new-topic-nickname");
        let topicName = util.$("#new-topic-name");
        nickname.value = "";
        topicName.value = ""
    };

    let wrap =  util.bake("div", {
        children: [
            util.bake("input", {
                id: "new-topic-name",
                class: "left-align",
                attributes:{
                    placeholder: "Enter topic name",
                maxlength: "255",
                    required: true
                }
            }),

            util.bake("input", {
                id: "new-topic-nickname",
                class: "left-align",
                attributes: {
                    placeholder: "Enter nickname",
                    maxlength: "255",
                    required: true
                }
            })
        ]
    })

    let form  = Modal.prepareModal(wrap, {
        closeMethods: ["button"],
        onOpen: clearFields,
        onClose: clearFields
    })

    form.addFooterBtn('Create topic',
                      'tingle-btn tingle-btn--primary tingle-btn--pull-right',
                      createClick);
    return form

}

export function bakeTopicJoinModal(joinClick){


    let clearFields = ()=>{
        let nickname = util.$("#join-topic-nickname");
        let topicName = util.$("#new-topic-name");
        let inviteCode = util.$("#join-topic-invite-code");
        nickname.value = "";
        topicName.value = "";
        inviteCode.value = "";
    };

    let wrap =  util.bake("div", {
        children: [

            util.bake("input", {
                id: "join-topic-invite-code",
                class: "left-align",
                attributes: {
                    placeholder: "Paste invite code",
                    maxlength: "255",
                    required: true
                }
            }),
            util.bake("input", {
                id: "join-topic-name",
                class: "left-align",
                attributes:{
                    placeholder: "Enter topic name",
                maxlength: "255",
                    required: true
                }
            }),

            util.bake("input", {
                id: "join-topic-nickname",
                class: "left-align",
                attributes: {
                    placeholder: "Enter nickname",
                    maxlength: "255",
                    required: true
                }
            })
        ]
    })

    let form  = Modal.prepareModal(wrap, {
        closeMethods: ["button"],
        onOpen: clearFields,
        onClose: clearFields
    })

    form.addFooterBtn('Join topic',
                      'tingle-btn tingle-btn--primary tingle-btn--pull-right',
                      joinClick);
    return form

}


//////////////////////////////////////////////
// export function bakeSettingsContainer(){ //
//     return util.bake("div", {            //
//         id: "settings-container",        //
//     })                                   //
// }                                        //
//////////////////////////////////////////////
