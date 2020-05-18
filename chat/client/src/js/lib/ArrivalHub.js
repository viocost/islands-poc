import { WildEmitter } from "./WildEmitter";

export class ArrivalHub{
    constructor(connector){
        let self = this
        WildEmitter.mixin(this);
        this.connector = connector;

        //on every message find topic id in header and emit with topic id
        // or emit to vault
        //
        this.connector.on("*", (event, data)=>{
            console.log(`Arrival hub received event from connector: ${event}`);
            if (data && data.headers){
                let dest = data.headers.pkfpDest || data.headers.pkfpSource;
                if (!dest){
                    console.error("Unknown destination packet received");
                    return;
                }
                self.emit(dest, data);
            } else {
                console.log(`MESSAGE WITHOUT HEADERS ARRIVED. Event: ${event}, data: ${JSON.stringify(data)}, `);
            }
        })

    }

}
