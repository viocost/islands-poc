# Islands. Virtualbox image prepare guide

This scripts prepare fully functioning islands image.

# Steps:
1. Create a new linux debian 64bit image in virtualbox
    RAM: 1024mb
    HDD: 8GB VMDK Dynamically allocated
    

2. Make a fresh install of debian 9 stretch 64-bit version with following
   options:
   - Language: Engilsh
   - Keymap: American English
   - Hostname: island
   - Domain name: islands
   - Root password: islands
   - New user name: island
   - Password: islands
   - Timezone: Eastern
   - Disk partitioning - guided use entire disk
   - All files in one partition 
   - Mirror - pick any
   - Same for ftp
   - packages: Standard system utilities, and SSH server

3. Login as root
4. download init.sh and vbox_full_setup.sh in /root/ on the VM
5. "Insert" guest additions CD in virtualbox. Do not add any additional network
interfaces yet. 
6. Run init script. 
7. Reboot
8. Check guest additions installation by configuring a shared folder called islandsData. It should
   appear in /media/sf_islandsData.
9. Run vbox_full_setup.sh -b branch
10. Next time vm boots it will look god.key in mounted shared folder. If it is
    there - the key will be added to trusted keys.


