const { exec } = require("child_process")


process.env["TEST_ENV"] = "HELLO WORLD!"
exec("node ./child.js", (err, stdout, stderr)=>{
    if (err){
        console.log(`Error: ${stderr.toString("utf8")}`)
    }
    console.log(`Out: ${stdout.toString("utf8")}`);
})
