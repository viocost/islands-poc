#include <array>
#include <memory>
#include <stdio.h>
#include <string>
#include <vector>
#include <iostream>
#include <fstream>
#include <regex>



#include "islandmanager.h"

IslandManager::IslandManager(){}
IslandManager::~IslandManager(){}

IslandManager& IslandManager::getInstance(){
    static IslandManager im;
    return im;
}


int IslandManager::shutdownIsland(){
    if(this->isIslandRunning()){
        this->exec(std::string("vboxmanage controlvm Island poweroff > " ) + this->CMD_RESPONSE_FILE);
    }
    return 0;
}

int IslandManager::launchIsland(){
    if (!this->isIslandRunning()){
        this->exec(std::string("vboxmanage startvm Island --type headless > " ) + this->CMD_RESPONSE_FILE);
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

    this->exec(std::string("vboxmanage showvminfo \"Island\" | findstr /c:\"running \"") + " > " + this->CMD_RESPONSE_FILE);
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


