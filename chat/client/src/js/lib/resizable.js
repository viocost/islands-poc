export function resizableInput(el, factor){
    let multiplier = Number(factor) || 8;
    function resize(){

        el.style.width = (el.value.length + 1) * multiplier  + "px"
    }

    let events = "keyup,keypress,focus,blur,change".split(",");
    for (let ev of events){
        el.addEventListener(ev, resize, false);
    }
    resize();
}