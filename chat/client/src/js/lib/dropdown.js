import * as util from "./dom-util";

export function reset(){
    document.querySelectorAll(".menu-dropdown").forEach(el=>{
        el.addEventListener("click", ()=>{
            console.log("Dropdown menu clicked!");
        })
    })
}

/**
 * Creates button-based dropdown menu
 * Menu items will be unordered list
 * @param menuTitle - string this will appear on the button
 * @param items
 */
export function bakeDropdownMenu(menuTitle, items){
    let dropdownContainer = util.bake("div", {class: ["dropdown-wrap"]});
    let button = util.bake("button", {class: "dropdown-button", text: menuTitle});
    let menuOptions = util.bake("ul", {class: "dropdown"});

    Object.keys(items).forEach(key =>{
        let option = util.bake("li", {class: "dropdown-item", text: key});
        option.addEventListener("click", (ev)=>{
            items[key](ev);
        });

        menuOptions.appendChild(option)
    });
    util.appendChildren(dropdownContainer, [button, menuOptions]);

    return dropdownContainer

}
