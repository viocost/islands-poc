#include <iostream>
#include <string>	
#include "settingsparser.hpp"

int main(){
	while( 1 ){
		std::string cmd;
		std::cout<<"Enter command: ";
		std::getline(std::cin, cmd);
		std::string cmdout = " > output.txt";
		std::system((cmd + cmdout).c_str());
		std::system("cat output.txt");
	}
	return 0;
}
