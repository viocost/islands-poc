const redis = require("redis")
const client = redis.createClient();
const sub = redis.createClient();

sub.on("message", (channel, message)=>{
    console.log(`Got message on channel ${channel}: ${message}`);
})
sub.subscribe("test-out")


function wait(){
    console.log(`waiting`);
    client.publish("test-in", "Hello dude!");
    setTimeout(wait, 2000);
}

wait();
