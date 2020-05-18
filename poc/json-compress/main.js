const jsonc = require("./JSONC.js")
const fs = require("fs")

let meta = `{"signature":"457486696a6fd63d09a4f9f08322dffdaca11f197f3105bec02216fdf8ee4d8bf0e259023a58188c8f03aea773bcf97d3eda328ff99cfe5b834cc3473544deab34fb109f03d7c6b7514d6f1332adffc6c587110525666c022140aefce913cb085338c4cb19266a24fb4afa5d159f905cd5ccec52f122b4ae04eab0213df162951201cf2b366b84014cd05a8a79c7e33773ae08081f32d0569b27ef0273a3f63440dad5551a38343fc05286e317c2ec4d44e3a4f07dc84af008b5143a917c76fd2273690ef326871292971c7030200232b757172b78af580a7e605a76a18fda35ce244ef194500298cbcabd84eb01ea86528a188efb1394e54cb8cf8b1c179edb","header":{"id":"d0d9165ff7f1c961","timestamp":"2019-09-27T15:16:58.343Z","metadataID":"782d51e7df0ab3380d57e668289aefb9","author":"4f3a9c95c09a29c507b52354d40a3f1562106ee2f51c4688a927476ed6964d65","nickname":"97d11a8d3034725e2f8817bcd265c3a8101b7095c506d6dece8eb4c35b732d45","recipient":"ALL","private":false},"body":"be800a4c7ca2291d44b8afc437e952c1e2ebb10af8178dad3ffb8f7fad615a9b","version":"1.0.2"}`

console.log(`Uncompressed: ${meta.length}`)

let compressed = jsonc.compress(JSON.parse(meta));
let packed = jsonc.pack(compressed);
console.log(packed);
