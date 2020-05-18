#pragma once
#include "rapidjson/document.h"
#include "rapidjson/writer.h"
#include "rapidjson/stringbuffer.h"
#include "rapidjson/filereadstream.h"
#include "rapidjson/filewritestream.h"
#include <string>
#include <map>

class Config{
	public:
		Config();
        ~Config();

        void set(std::string k, std::string val);
        std::string get(std::string k);


        /**
         * @brief Config::load
         * Loads config from file config.json and saves the rapidjson object
         * inside local variable config
         */
        void load();

        bool is_config_exist(std::string& name);

        void save_to_file();

        /**
         * @brief init_default
         * initializes config object and sets its values to hardcoded default values
         * It does not persist config to disk
         */
        void init_default();
	private:
        std::map<std::string, std::string> defaults;
        void init_json_config();
        bool is_initialized();
        void set_initialized(bool);
        void set_default_for_missing_params();
        rapidjson::Document* config;
        bool initialized = false;




};



