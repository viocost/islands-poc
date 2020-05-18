/**
 *
 *
 * Bakes DOM element as per request in data
 *
 * @param name - name of the element such as div, button etc
 *
 * @param recipe
    * recipe is a JSON object with following properties:
 *  * id - string id
 *  * class - list of class. Array or single entry
 *  * attributes - object of attributes key vaule pairs
 *  * html - inner html
 *  * text - inner text
 *  * val  - value
 *  * style - css string inline style for the element
 *  * children - single DOM element or array of DOM elements that will be appended as children
 *  * listeners - JSON object with keys - events types, vaules - event handlers
 */
export function bake(name, recipe){
    let el = document.createElement(name);
    if(!recipe) return el;

    if(recipe.class){
        if (typeof recipe.class === "object"){
            for (let c of recipe.class){
                el.classList.add(c);
            }
        }else if (typeof recipe.class === "string"){
            el.classList.add(recipe.class);
        }else {throw new Error("Bake parameters invalid");}
    }

    if(recipe.listeners){
        for(let ev of Object.keys(recipe.listeners)){
            el.addEventListener(ev, recipe.listeners[ev])
        }
    }

    if(recipe.id){
        el.setAttribute("id", recipe.id)
    }

    if(recipe.src){
        el.setAttribute("src", recipe.src)
    }

    if (recipe.attributes){
        for (let key of Object.keys(recipe.attributes)){
            el.setAttribute(key, recipe.attributes[key])
        }

    }

    if (recipe.style){
        el.style = recipe.style;
    }

    if (recipe.html)
        el.innerHTML = recipe.html;

    if (recipe.text)
        el.innerText = recipe.text;

    if (recipe.val)
        el.value = recipe.val;

    if (recipe.children){
        appendChildren(el, recipe.children);
    }

    return el
}

// ---------------------------------------------------------------------------------------------------------------------------
// CSS class wrapers
export function addClass(element, _class){
    let node = verifyGetElement(element);
    node.classList.add(_class);
}

export function removeClass(element, _class){
    let node = verifyGetElement(element);
    node.classList.remove(_class);
}

export function toggleClass(element, _class){
    let node = verifyGetElement(element)
    return node.classList.toggle(_class);
}

export function hasClass(element, _class){
    let node = verifyGetElement(element)
    return node.classList.contains(_class);
}
//end//////////////////////////////////////////////////////////////////////////


// ---------------------------------------------------------------------------------------------------------------------------
// Setting text and html
export function html(element, html){
    let node = verifyGetElement(element);
    node.innerHTML = html;
}

export function text(element, text){
    let node = verifyGetElement(element);
    node.innerText = text;
}
//end//////////////////////////////////////////////////////////////////////////

/**
 * Less verbose wrapper for setting value;
 *
 */
export function val(element, val){
    let node = verifyGetElement(element);
    node.value = val;
}

/**
 * Given parent element appends one or multiple children
 * @param parent DOM node
 * @param children can be array of nodes or a single node
 */
export function appendChildren(parent, children){
    let parentElement = verifyGetElement(parent);
    if (children instanceof  Array){
        for (let child of children){
            let node = verifyGetElement(child);
            parentElement.appendChild(node)
        }
    } else {
        let node = verifyGetElement(children)
        parentElement.appendChild(node)
    }
}

export function prependChildren(parent, children){
    let parentElement = verifyGetElement(parent);
    if (!parentElement.firstChild){
        appendChildren(parent, children)
    } else {
        if(children instanceof Array){
            for (let i=0; i<children.length; ++i){
                let node = verifyGetElement(children[children.length-1-i])
                parent.insertBefore(node, parent.firstChild)
            }
        }else{
                let node = verifyGetElement(children)
                parent.insertBefore(node, parent.firstChild)
        }
    }
}

/**
 * Removes all children of a give element
 */
export function removeAllChildren(element){
    let el = verifyGetElement(element);
    let last
    while(last = el.lastChild){
        el.removeChild(last);
    }
}


/**
 * give element removes it from DOM
 *
 */
export function remove(element){
    let el = verifyGetElement(element)
    el.parentNode.removeChild(el);
}


/**
 * Given reference element inserts target element after referenceElement on the same level
 * as sibiling.
 * Both reference element and target element must exist, or error will be thrown
 */
export function addBefore(referenceElement, element){
    let refElement = verifyGetElement(referenceElement);
    let target = verifyGetElement(element);
    refElement.insertAdjacentElement('beforebegin', target);
}

/**
 * Given reference element inserts target element after referenceElement on the same level
 * as sibiling.
 * Both reference element and target element must exist, or error will be thrown
 */
export function addAfter(referenceElement, element){
    let refElement = verifyGetElement(referenceElement);
    let target = verifyGetElement(element);
    refElement.insertAdjacentElement('afterend', target);
}



// Given single node, or array of nodes wrapse them in new div element.
// class - single class or array of class that will be set for the new div.
export function wrap(elements, _class){
    return bake("div", {
        children: elements,
        class: _class
    })
}

/**
 * Less verbose wrapper for document.querySelector
 * Node MUST exits or error will be thrown
 * Element can be either DOM element or selector
 */
export function $(element, parent = document){
    if (parent === document){
        return verifyGetElement(element)
    }
    parent = verifyGetElement(parent);
    res = parent.querySelector(element);
    if (res === undefined){
        throw new Error(`Element ${element} is not found at ${parent.nodeName}`)
    }
    return res;
}

/**
 * Less verbose wrapper for document.querySelectorAll
 * Nodes may not exist, no check is performed
 * selector must be a string
 */
export function $$(selector, parent = document){
    if (parent !== document){
        parent = verifyGetElement(parent);
    }
    return parent.querySelectorAll(selector)
}


/**
 * Given element or selector returns next dom element or null if such doesn't exist
 */
export function $nextEl(element){
    element = verifyGetElement(element);
    return element.nextElementSibling;
}


/**
 * Given element or selector returns previous dom element or null if such doesn't exist
 */
export function $prevEl(element){
    element = verifyGetElement(element);
    return element.previousElementSibling;
}


export function displayNone(node){
    try{
        displayElement(node, "none")
    }catch(err){
        console.log("Display none fail: " + err)
    }
}

// Alias in jquery style for display: hide
export function hide(node){
    try{
        displayElement(node, "none")
    }catch(err){
        console.log("Display none fail: " + err)
    }
}

export function displayBlock(node){
    displayElement(node, "block")
}

// Alias in jquery style for display: block
export function show(node){
    displayElement(node, "block")
}

export function displayFlex(node){
    displayElement(node, "flex")
}

// Alias in jquery style for display: flex
export function flex(node){
    displayElement(node, "flex")
}

export function isShown(el){
    let node = verifyGetElement(el)
    return node.style.display === "flex" || node.style.display === "block";
}

/**
 * Internal. Sets node display property
 *
 */
function displayElement(element, display){
    let node = verifyGetElement(element);
    node.style.display = display;
}

export function generateRandomId(length = 10, prefix="", postfix=""){
    let alphabet = "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    let symbols = [];
    for(let i=0; i<length; ++i){
        symbols.push(alphabet[Math.floor(Math.random() * alphabet.length)])
    }

    return `${prefix.length > 0 ? prefix + "-" : ""}${symbols.join("")}${postfix.length > 0 ? "-" + postfix : ""}`;
}

/**
 * Helper function. Given either DOM element or selector
 * makes sure it exists and valid, and returns it.
 */
function verifyGetElement(element){
    let node = element
    if (typeof node === "string"){
        node = document.querySelector(element);
    }
    if (!node){
        throw new Error(`Element ${element} is undefined`);
    } else if(!(node instanceof Element) && (!(node instanceof Text))){
        throw new Error("Type of element is invalid");
    }
    return node;
}

export function isParent(parent, child){
    if(!parent || !child || !(parent instanceof Element) || !(child instanceof Element)){
        return false
    }

    let node = child.parentNode;
    while(node !== null){
        if(node === parent){
            return true;
        }
        node = node.parentNode;
    }
    return false;
}
