# Islands install instruction
Islands requires Docker version at least 18.** to be installed.

## Docker installation

Update the apt package index:
```
$ sudo apt-get update
```
Install packages to allow apt to use a repository over HTTPS:
```sh
$ sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common

```
Add Docker’s official GPG key:
```
$ curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
```
Verify that you now have the key with the fingerprint 9DC8 5822 9FC7 DD38 854A E2D8 8D81 803C 0EBF CD88, by searching for the last 8 characters of the fingerprint.
```
$ sudo apt-key fingerprint 0EBFCD88

pub   4096R/0EBFCD88 2017-02-22
      Key fingerprint = 9DC8 5822 9FC7 DD38 854A  E2D8 8D81 803C 0EBF CD88
uid                  Docker Release (CE deb) <docker@docker.com>
sub   4096R/F273FCD8 2017-02-22
```

Use the following command to set up the stable repository. You always need the stable repository, even if you want to install builds from the edge or test repositories as well. To add the edge or test repository, add the word edge or test (or both) after the word stable in the commands below.

Note: The lsb_release -cs sub-command below returns the name of your Ubuntu distribution, such as xenial. Sometimes, in a distribution like Linux Mint, you might need to change $(lsb_release -cs) to your parent Ubuntu distribution. For example, if you are using Linux Mint Rafaela, you could use trusty.
x86_64 / amd64
armhf
IBM Power (ppc64le)
IBM Z (s390x)
```
$ sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
   
 ```
   
Note: Starting with Docker 17.06, stable releases are also pushed to the edge and test repositories.

Learn about stable and edge channels.

INSTALL DOCKER CE
Update the apt package index.
```
$ sudo apt-get update
```
Install the latest version of Docker CE, or go to the next step to install a specific version:

```
$ sudo apt-get install docker-ce
```

# Islands installation

* Choose or create a directory for storing Islands data,

* Clone the latest version of Islands:
```
git clone https://github.com/viocost/islands.git
```
Alternatively, you may go to https://github.com/viocost/islands
and download islands directly from there as a zip archive.

# Starting Islands server
**Tested on Ubuntu 18.04**
* cd into __chat__ inside islands directory
run
```
cmod +x run.sh
```
run `run.sh` with appropriate options:
- `-h` Print help info
 - `-df` - path to data directory  you have created. If not specified - the script will create islandsData directory within the source folder.
   you can later migrate the entire data by moving the folder. When running the script - specify the new path
 - `-p` port your island will listen on
 - `-db` debug mode
 - `-dp` port number for attaching local debugger
 
 # Post install
 Once your island is up - you may setup admin key
 In browser go to `http://url.to.your.island:port/admin`
 Follow the instructions on the page.
 
 
   