#include <string>
#include <iostream>
#include <sys/stat.h>
#include "config.h"
#include "rapidjson/document.h"
#include "rapidjson/writer.h"
#include "rapidjson/stringbuffer.h"
#include "rapidjson/filereadstream.h"
#include "rapidjson/filewritestream.h"
#include <QDebug>

Config::Config(){
    //Default params map
    this->defaults["vname"] = "Island";
    this->defaults["vboxpath"] = "/usr/local/bin/vboxmanage";
    this->defaults["conf_file_name"] = "config.json";

    if(Config::is_config_exist(this->defaults["conf_file_name"])){
        qDebug()<<"Loading config from file";
        this->load();
        this->set_default_for_missing_params();
    } else{
        qDebug()<<"LInitializing default";
        this->init_default();
        this->save_to_file();
    }

    this->set_initialized(true);
}
Config::~Config(){
    delete config;
}



void Config::load(){
    FILE* fp = fopen(this->defaults["conf_file_name"].c_str(), "r");
    char readBuffer[65536];
    rapidjson::FileReadStream is(fp, readBuffer, sizeof(readBuffer));
    rapidjson::Document * d = new rapidjson::Document();
    d->SetObject();
    d->ParseStream(is);

    this->config = d;
    this->set_initialized(true);
}


void Config::set(std::string k, std::string v ){
    if(!this->is_initialized()){
        qDebug()<<"CONFIG HAS NOT BEEN INITIALIZED!";
        throw "Config is not initialized.";
    }
    rapidjson::Value val;
    rapidjson::Value key;
    val.SetString(rapidjson::StringRef(v.c_str()));
    key.SetString(rapidjson::StringRef( k.c_str()));
    this->config->AddMember(key, val, this->config->GetAllocator());
}


std::string Config::get(std::string k){
    if(this->config->HasMember(k.c_str())){
        return (*this->config)[k.c_str()].GetString();
    }
    return "";
}

bool Config::is_config_exist (std::string& name) {
  struct stat buffer;
  return (stat (name.c_str(), &buffer) == 0);
}


void Config::save_to_file(){
    if(!this->is_initialized()){
        throw "Config is not initialized.";
    }
    FILE* fp = fopen("config.json", "w");
    char writeBuffer[65536];
    rapidjson::FileWriteStream os (fp, writeBuffer, sizeof(writeBuffer));
    rapidjson::Writer<rapidjson::FileWriteStream> writer(os);
    (*this->config).Accept(writer);
    fclose(fp);
}

void Config::init_default(){
    delete this->config;
    this->init_json_config();
    this->set_initialized(true);
    this->set("vmname", this->defaults["vname"]);
    this->set("vmid", "");
    this->set("vboxpath", this->defaults["vboxpath"]);
}


bool Config::is_initialized(){
    return this->initialized;
}

void Config::set_initialized(bool initialized){
    this->initialized = initialized;
}


void Config::init_json_config(){
    this->config = new rapidjson::Document;
    this->config->SetObject();
}


void Config::set_default_for_missing_params(){
    bool changed = false;
    for(auto it = this->defaults.begin(); it != this->defaults.end(); ++it){
        if(!this->config->HasMember(it->first.c_str())){
            this->set(it->first, it->second);
            changed = true;
        }
    }

}




