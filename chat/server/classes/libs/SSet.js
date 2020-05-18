class SSet{
    constructor(iterable){

        this._set = new Set(iterable);
    }

    static formatInput(input){
        if (!(input instanceof SSet)){
            return new SSet(input)
        } else{
            return input;
        }
    }

    union(set){
        set = SSet.formatInput(set);
        return new SSet([...this.toArray(), ...set.toArray()]);
    }

    difference(set){
        set = SSet.formatInput(set);
        return new SSet(this.toArray().filter(x => !set.has(x)))
    }

    symmetricDifference(set){
        set = SSet.formatInput(set);
        return this.union(set).difference(this.intersection(set));
    }

    intersection(set){
        set = SSet.formatInput(set);
        return new SSet(this.toArray().filter(x => set.has(x)))
    }

    equal(set){
        set = SSet.formatInput(set);
        return this.symmetricDifference(set).length() === 0
    }

    has(x){
        return this._set.has(x)
    }

    length(){
        return this._set.size
    }

    empty(){
        return this._set.size === 0
    }

    add(x){
        this._set.add(x);
    }

    remove(x){
        this._set.delete(x);
    }

    toSet(){
        return this._set;
    }

    toArray(){
        return Array.from(this._set)
    }

}

if(typeof module === "object" && module.hasOwnProperty('exports')){
    module.exports = SSet;
}

