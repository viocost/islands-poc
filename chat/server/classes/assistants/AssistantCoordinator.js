const EventEmitter = require("events").EventEmitter;

/**
 * This singleton class notifies assistants when various events happen
 * Any assistant can subscribe to relevant events
 * Any assistant can notify other assistants by calling notify method
 *
 */
class AssistantCoordinator{
    constructor(){
        throw new Error("Assistant coordinator cannot be initialized directly.");
    }
    static initialize(){
        AssistantCoordinator._notifier = new EventEmitter();
    }
    static notify(ev, data){
        AssistantCoordinator._notifier.emit(ev, data);
    }

    static on(ev, handler){
        AssistantCoordinator._notifier.on(ev, handler);
    }
}

module.exports = AssistantCoordinator;
