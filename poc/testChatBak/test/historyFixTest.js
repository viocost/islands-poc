const HistoryFixer = require("./classes/libs/HistoryIndexFixer.js");
let hf = new HistoryFixer("/home/kostia/islandsData2/history/2be8f83d6c9cf19bc0e689fd14646cf3e84b571cfa784f56954b9d19e9fbf1e9", "history_store");

setTimeout(async ()=>{
    await hf.fixHistory();
    await hf.finalize()
}, 1);
