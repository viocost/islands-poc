#pragma once

#include <string>

class IslandManager{
    public:
        static void initialize();
        static IslandManager& getInstance();
        int launchIsland();
        int shutdownIsland();
        int restartIsland();
        bool isIslandRunning();
        int setDataDirectory();
        int setMainPort();

    private:
        IslandManager();
        ~IslandManager();
        const std::string CMD_RESPONSE_FILE = "response.tmp";
        IslandManager(IslandManager const&) = delete;
        IslandManager& operator= (IslandManager const&) = delete;
        int exec(std::string command);
};


