const fs = require('fs');
const Metadata = require('../classes/Metadata');
const DIR = "./files/";


/****************************************************
 * This module contains all the functions           *
 * persisting and retrieving chat data and metadata *
 *                                                  *
 ***************************************************/


/**
 * Finds file on disk using user's private key
 * or creates a new file, in case if file not found
 * not working on linux with flag a+
 * */
function get_history_file(publicKey){
    //check public key
    return new Promise((resolve, reject)=>{
        //Get file by public key using history folder
        //a+ open for reading and appending. The file is created if it does not exist.
        fs.open(DIR + publicKey + ".history", 'a+', (err, fd)=>{
            if(err)
                reject(err);
            else
                resolve(fd);
        });
    });
}









module.exports.get_history_file = get_history_file;


module.exports.run_files_experiment = function(req, res){
    get_history_file(req.body.public_key)
        .then(fd =>{
            //do something with file


            play_with_file(fd, req.body.public_key);

            fs.close(fd);
        })
        .catch(err =>{
            console.error("ERRRRRROR: "+ err);
        })
};

function play_with_file(fd, user){
    let mtd = new Metadata();
    mtd.add_user(user);
    fs.appendFileSync(fd, JSON.stringify(mtd));
}


function append_to_history(fd, message){
    //try to obtain last wrappingup record

    //if it does not exists

        //append new message and generate first wrappingup record

    //else it exists
        //modify wrappingup record according to data type

        //append new message

        //append new wrappingup record

}


