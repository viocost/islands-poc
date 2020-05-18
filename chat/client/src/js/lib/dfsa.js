import * as CuteSet from "cute-set";

function DFSA() {}

const dfsaAssert = function(cond, msg = ""){
    if(!cond){
        throw new Error(`dfsa error: ${msg}`);
    }
}

DFSA.mixin = function(constructor, param = {}){
    let prototype = constructor.prototype || constructor;

    const { states, initialState, finalState, transitionRules } = param;

    prototype.isDFSA = true;
    prototype._dfsa = {
        currentState: null,
        initialState: null,
        finalState: null,
        halted: false,
        states: states ? new CuteSet(states) : new CuteSet(),
        transitionRules: {}

    }

    prototype.setTransitionRules = function (state, transitionStates){
        dfsaAssert(prototype._dfsa.states.has(state), "setTransitionRules: state does not exist")
        let transStatesSet = new CuteSet(transitionStates);
        dfsaAssert(transStatesSet.subsetOf(prototype._dfsa.states), "Transition states must be a subset of possible states.")
        prototype._dfsa.transitionRules[state] = transStatesSet;
    }

    prototype.transition = function(state){
        dfsaAssert(prototype._dfsa.states.has(state), `Transition error: state ${state} does not exist`)
        dfsaAssert(prototype._dfsa.transitionRules[prototype._dfsa.currentState].has(state), `Transition rule violation: cannot transition from ${prototype._dfsa.currentState} to ${state}`)
        dfsaAssert(!prototype._dfsa.halted, "Transition error: machine halted")
        prototype._dfsa.currentState = state;
        if (state === finalState) prototype._dfsa.halted = true;
    }

    prototype.setInitialState = function(state){
        dfsaAssert(prototype._dfsa.states.has(state), `Initial state ${state} is not in set of possible states` )
        prototype._dfsa.initialState = state;
    }

    prototype.setFinalState = function(state){
        dfsaAssert(prototype._dfsa.states.has(state), `Initial state ${state} is not in set of possible states` )
        prototype._dfsa.finalState = state;
    }

    prototype.dfsaInit = function(){
        dfsaAssert(prototype._dfsa.initialState, "dfsa error: No initial state set")
        prototype._dfsa.currentState = prototype._dfsa.initialState;
    }


    if(initialState) prototype.setInitialState(initialState);
    if(finalState) prototype.setFinalState(finalState);

    for(let state of prototype._dfsa.states){
        prototype.setTransitionRules(state, transitionRules && transitionRules.hasOwnProperty(state) ?
                                    transitionRules[state] : new CuteSet())
    }

}

DFSA.mixin(DFSA);

if (typeof module !== "undefined"){
    module.exports.DFSA = DFSA;
}else {
    export DFSA;
}
