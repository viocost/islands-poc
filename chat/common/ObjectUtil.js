module.exports.clone = function clone(obj){
    if(!(obj instanceof Object)) return obj
    let res = {}
    for(let key of Object.keys(obj)){
        if (obj[key] instanceof Array){
            res[key] = []
            for(let item of obj[key]){
                res[key].push(clone(item));
            }
        } else if (obj[key] instanceof Object){
            res[key] = clone(obj[key]);
        } else {
            res[key] = obj[key];
        }
    }
    return res
}

module.exports.isEquivalent = function (obj1, obj2){
    if(typeof(obj1) !== typeof(obj2)) return false;

    if (obj1 === null || (typeof obj2 !== "object")){
        return obj1 === obj2
    }

    if (obj1.constructor.name !== obj2.constructor.name){
        return false;
    }

    if(obj1 instanceof Array){
        if (obj1.length !== obj2.length){
            return false
        }
        for (let i=0; i<obj1.length; i++){
            if(!isEquivalent(obj1[i], obj2[i])) return false
        }
        return true;
    }

    let keys1 = Object.keys(obj1)
    let keys2 = Object.keys(obj2)

    if (keys1.length !== keys2.length) return false;
    for(let key of keys1){
        if(!(keys2.includes(key))) return false;
        if(!isEquivalent(obj1[key], obj2[key])){
            return false;
        }
    }

    return true;
}

module.exports.generateRandomObj = function (size = 1000, maxDepth = 5){
    let res = {}
    for(let i=0; i<size; i++){
        if (maxDepth === 0){
            return generateRandomId();
        }
        let val;

        if(Math.random() < .1){
            val = generateObj(10, maxDepth - 1);
        } else if(Math.random() > .9){
            val = []
            for (let j =0; j<3; j++){
                val.push(generateObj(5, maxDepth - 1))
            }
        } else {
            val = generateRandomId();
        }
        res[generateRandomId()] = val
    }
    return res;
}


function generateRandomId(length = 10, prefix="", postfix=""){
    let alphabet = "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    let symbols = [];
    for(let i=0; i<length; ++i){
        symbols.push(alphabet[Math.floor(Math.random() * alphabet.length)])
    }

    return `${prefix.length > 0 ? prefix + "-" : ""}${symbols.join("")}${postfix.length > 0 ? "-" + postfix : ""}`;
}
