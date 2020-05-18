#include <array>
#include <memory>
#include <stdio.h>
#include <string>
#include <vector>
#include <iostream>
#include <fstream>
#include <regex>
#include <sstream>



#include "islandmanager.h"

IslandManager::IslandManager(){
    this->config = new Config();
}
IslandManager::~IslandManager(){
    delete config;
}


int IslandManager::shutdownIsland(){
    if(this->isIslandRunning()){
        std::ostringstream ss;
        ss<<this->get_vbox_path()<<" controlvm " << this->get_vmname() \
         << " poweroff > " << this->CMD_RESPONSE_FILE;
        std::string cmd = ss.str();
        std::cout<<cmd;
        this->exec(cmd);
    }
    return 0;
}

int IslandManager::launchIsland(){
    if (!this->isIslandRunning()){
        std::ostringstream ss;
        ss<<this->get_vbox_path()<<" startvm "<< this->get_vmname() \
         << " --type headless > " << this->CMD_RESPONSE_FILE;
        this->exec(ss.str());
    }
    return 0;
}

int IslandManager::restartIsland(){
     if (this->isIslandRunning()){
         this->shutdownIsland();
         this->launchIsland();
     }
     return 0;
}


bool IslandManager::isIslandRunning(){
    std::string* response = new std::string();
    std::string temp;
    std::ostringstream ss;
    ss<<this->get_vbox_path()<< " showvminfo \""\
     <<this->get_vmname()<<"\" | grep running > " << this->CMD_RESPONSE_FILE;
    this->exec(ss.str());
    std::ifstream input(this->CMD_RESPONSE_FILE);
    while(input>>temp){
        *response += temp;
    }
    std::regex re("^(?=.*State)(?=.*running)(?=.*since).+");
    bool result =  std::regex_match(*response, re);
    delete response;
    return result;
}

int IslandManager::exec(std::string command){
	std::system(command.c_str());
    return 0;
}


void IslandManager::restore_config_defaults(){

    this->config->save_to_file();
}

void IslandManager::init_config(){
    this->config = new Config();
}

//Getters
std::string IslandManager::get_vbox_path(){
    return this->config->get("vboxpath");
}

std::string IslandManager::get_vmname(){
    return this->config->get("vmname");
}

//Setters
void IslandManager::set_vbox_path(std::string path){
    this->config->set("vboxpath", path);
}

void IslandManager::set_vname(std::string name){
    this->config->set("vmname", name);
}

void IslandManager::set_vmid(std::string id){
    this->config->set("vmid", id);
}
