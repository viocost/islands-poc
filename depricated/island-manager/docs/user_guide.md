

## Getting started
To setup your island you need to **install VirtualBox** and **import Island image**, which is .isld file. 
Click "Run setup" button and follow the instruction. 
If setup finishes successfully - you will have VirtualBox installed and Island Virtual Machine (VM) imported and configured.

## Main control
**"Launch Island"** button starts the Island VM. You may choose whether you want to start in quiet mode or in normal mode. <br> In quiet VM will run quietly in the background. In normal mode you will see the VM's window with terminal. The "normal" option is useful for debugging. <br> **"Stop Island"** button will shout down the VM. There are 2 options: soft and hard.
Soft sends ACPI shutdown signal to VM, while hard shuts down the VM immediately. <br>**"Restart Island"** button will does hard reset of the VM.

## Access
Once you have your Island up and running, first thing you need to do it to **setup your admin password**. To do that - click "Admin access" link and follow the instructions in the browser. <br>Once the password is set, local access link will appear in the manager, which leads to the login page.<br>Your Island is now all set. You may create topics, join topics, manage hidden services and invite your friends. Access your island by the links displayed in your Islands Manager.

## Keys
Keys are needed to sign and verify Islands images. When you import an .isld image - its signature is verified, and if key is not in your list of trusted keys - you will be warned about that. Only use images from the publishers you trust. <br>If you choose to import an image from an unknown publisher - the key will be imported as trusted, and in the future there will not be a warning.<br>You may create your own keys. to do that - open Keys -> My keys and click "Create key" button. You may also assign aliases to keys.<br>You may import keys from pem files. It is assumed that all user keys are protected with password. Password is also required when you are creating a new key.

## Creating images
If you wish to create your own Islands image and distribute it - you can do it with "Island image authoring" tool. You need to have .ova image and your private key ready. Go tools -> Island image authoring. Fill the entire form and click "Go" button. The .isld file signed by your private key will be produced as a result. You may choose to start seeding it immediately, and simply share the magnet link with your friends.
The manager is designed to track artifacts. If you select an existing artifact, the manager will try load previous version info and pre-fill the form.

## .isld files
.isld file is essentially a zip archive, which includes .ova image, info file with the information, hash and signature of the .ova image, and the signature of the info file. 

## Torrents
Islands Manager is also a simple torrent client. Whenever you download an image via magnet link, you also seed that image. You may use Islands Manager as your torrent client. Adding torrents is only possible via magnet links for now. Torrents features include adding, creating, stopping, pausing, resuming, limiting up and down speed. You are encouraged to seed Islands images to make Islands more available. 

## Configuration
Islands VM requires minimal configuration. That includes creation and configuration of virtual DHCP server and addig "Host-only" adapter. "Host-only" adapter makes it possible to access your Island from the local machine. <br> Configuration of the VM requires setup of shared folder. The folder is used by the VM to store all the data and user information. Nothing is stored inside the VM. <br>You may reconfigure the shared folder from the config window. <br> If you already have a Virtualbox and Islands VM installed and just installing the Islands Manager - you may select any virtual machine registered in VirtualBox to be an Island VM. <br>You may also delete your Island VM. That will stop the VM, if it is running, unregister it and delete all its data from the hard drive. It will not delete, however, the old .isld file, if you still have it.<br>You may replace/update your Island VM, which is essentially the same thing. Doing that will replace your current Island VM with a new one.


## Technical requirements
Islands can only run on 64-bit host. Minimum supported Windows version is 8.
Since Islands is a virtual machine itself - it cannot run inside a virtual machine.
The Islands Manager alone can, but running the VM itself would require a nested virtualization, which is not yet possible. <br>Islands Manager has been tested on MAC OS Sierra, High Sierra, and Mojave. <br>Running Islands in Linux would require python3.7 and virtual environment. A separate instruction for linux may be found in the docs folder.



