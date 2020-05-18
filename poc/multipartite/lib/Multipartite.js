class Vertex{
    constructor(val, bucket){

    }
}

class Multipartite{
    constructor(){
        this._buckets = {};
        this._edgesK = [];
        this._edgesV = [];
    }

    addBucket(name = Multipartite._required()){
        if(!this._buckets.hasOwnProperty(name)){
            this._buckets[name] = {};
        }
    }

    pushPair(bucket1, val1, bucket2, val2){

    }

    connect(bucket1, val1, bucket2, val2){

    }

    disconnect(){

    }

    removeVertex(){

    }

    key(){

    }

    val(){

    }

    _insertKeyEdge(){

    }

    _insertValEdge(){

    }

    static _required(){
        throw new Error("Missing required parameter");
    }

}