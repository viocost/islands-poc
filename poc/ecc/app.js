const EC = require('elliptic').ec;

let ec = new EC('secp256k1')


console.log("Generating keys");

let t1 = new Date();
let t2 = new Date()
let key = ec.genKeyPair();

console.log(`Keys generated in ${new Date() - t1}ms`);

// Sign the message's hash (input must be an array, or a hex-string)
var msgHash = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ];

t1 = new Date()
var signature = key.sign(msgHash);

console.log(`Signed in  ${new Date() - t1}ms`);

// Export DER encoded signature in Array
var derSign = signature.toDER();

// Verify signature

t1 = new Date()
console.log(key.verify(msgHash, derSign));

console.log(`Verified in  ${new Date() - t1}ms`);

console.log(`Whole test finished in ${new Date() - t2}ms`);
