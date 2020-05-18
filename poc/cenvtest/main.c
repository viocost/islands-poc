#include <stdlib.h>
#include <iostream>


using namespace std;

int main(void){

  char * val;
  val = getenv("TEST");
  cout<<"This is a test message\n";
  cout<<val;
  return 0;
}
