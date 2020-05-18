#! /bin/bash
#
# init.sh
# Copyright (C) 2018 kostia <kostia@i.planet-a.ru>
#
# Distributed under terms of the MIT license.
# 
# This script runs on first launch of blank Islands image
# It detects virtual environment and installs appropriate tools.
# For virtualbox it installs guest additions, for Vmware - vmware tools (NOT YET IMPLEMENTED)
# If any tool appear to be installed - script removes itself from startup and exits

sleep 4s

install_guest_additions()
{
	apt update -y
	apt install build-essential module-assistant -y
	read -p "!!! Please make sure Virtualbox guest additions image is inserted and then press enter to continue..."
	mount /media/cdrom
	m-a prepare -i
	sh /media/cdrom/VBoxLinuxAdditions.run
	umount /media/cdrom
	systemctl disable rc-local
	rm -rf /etc/rc.local
	rm -rf /etc/systemd/system/rc-local.service
}

prepare_network()
{
	sed -i 's/GRUB_CMDLINE_LINUX=""/GRUB_CMDLINE_LINUX="net.ifnames=0 biosdevname=0"/g' /etc/default/grub
	grub-mkconfig -o /boot/grub/grub.cfg
	IFACE=$( ls /sys/class/net/ | egrep -v lo | xargs )
	sed -i "s/allow-hotplug $IFACE/allow-hotplug eth0/g" /etc/network/interfaces
	sed -i "s/iface.*$IFACE.*inet dhcp/iface eth0 inet dhcp/g" /etc/network/interfaces
	echo "allow-hotplug eth1" >> /etc/network/interfaces
	echo "iface eth1 inet dhcp" >> /etc/network/interfaces
	echo "allow-hotplug eth2" >> /etc/network/interfaces
	echo "iface eth2 inet dhcp" >> /etc/network/interfaces
}

# if Virtualbox and no guestadditions installed
if cat /sys/devices/virtual/dmi/id/product_name | grep -iqF VirtualBox; then
	if ! lsmod | grep -iqF vboxguest; then
		echo 'installing guest additions'
		install_guest_additions
		echo Preparing network
		prepare_network
		reboot
	fi	
fi	



