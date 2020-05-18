const Bimap = require('./Bipartite');


let a = new Bimap();
a.push("onion1", "socket");
a.push("onion2", "socket");
a.push("onion3", "socket");

a.print()

console.log(a.hasKey("onion1"))