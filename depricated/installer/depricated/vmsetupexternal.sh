#! /bin/bash
#
# vmsetupexternal.sh
# Copyright (C) 2018 kostia <kostia@i.planet-a.ru>
#
# Distributed under terms of the MIT license.
#

# ADD VM

# ADD shared folder

# Add network adapter


# Importing applience and ignoring host-only settings
vboxmanage import Island.ova --vsys 0  --unit 7 --ignore

# Clear and add host-only virtual adapter this will create vboxnet<n> where n is an adapter seq# By default it will be vboxnet0. User should be able to change this
# if already using this adapter with other appliences.
# It is impossible to specify name for create command, so it will create vboxnet<n> 
# and n will be the lowest available

vboxmanage hostonlyif remove vboxnet0
vboxmanage hostonlyif create 

# Configuring host-only network

VBoxManage hostonlyif create
VBoxManage hostonlyif ipconfig vboxnet0 --ip 192.168.56.1
VBoxManage dhcpserver add --ifname vboxnet0 --ip 192.168.56.1 --netmask 255.255.255.0 --lowerip 192.168.56.100 --upperip 192.168.56.200
VBoxManage dhcpserver modify --ifname vboxnet0 --enable


# Enabling hostonly adapter as adapter 2
vboxmanage modifyvm Island --nic2 hostonly

# Enable NAT adapter as adapter 1
vboxmanage modifyvm Island --nic1 nat

# Connecting cables
vboxmanage modifyvm Island --cableconnected1 on
vboxmanage modifyvm Island --cableconnected2 on

# Enable port forwarding
vboxmanage modifyvm Island --natpf1 "r1, tcp, 127.0.0.1, 4000, 0.0.0.0, 4000"

#Mounting shared folder
vboxmanage sharedfolder add Island --name islandsData --hostpath ~/islandsData/islandsData/ --automount


