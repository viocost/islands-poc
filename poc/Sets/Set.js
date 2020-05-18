

class SSet{
    constructor(iterable){
        this._set = new Set(iterable);
    }

    static formatInput(set){
        if(!set){
            throw "empty input"
        }

        if (!set instanceof SSet){
            return new SSet(set)
        } else{
            return set;
        }

    }

    union(set){
        set = SSet.formatInput(set);
        return new SSet(this.toArray().concat(set.toArray()));
    }

    difference(set){
        set = SSet.formatInput(set);
        return new SSet(this.toArray().filter(x => !set.has(x)))
    }

    symmetricDifference(set){
        set = SSet.formatInput(set);
        return this.difference(this.intersection(set));
    }

    intersection(set){
        set = SSet.formatInput(set);
        return new SSet(this.toArray().filter(x => set.has(x)))
    }

    equal(set){
        set = SSet.formatInput(set);

    }

    has(x){
        return this._set.has(x)
    }

    length(){
        return this._set.size
    }

    empty(){
        return this._set.size == 0
    }

    add(x){
        this._set.add(x);
    }

    remove(x){
        this._set.delete(x);
    }

    toArray(){
        return Array.from(this._set)
    }

    toString(){
        return this._set.toString()
    }
}

if(typeof module === "object" && module.hasOwnProperty('exports')){
    module.exports = Set;
}

SSet.prototype.toString = function(){
    return this._set.toString();
};