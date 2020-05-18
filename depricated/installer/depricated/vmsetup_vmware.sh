#!/bin/bash
# Origin state:
# Assuming we have clean Debian installation with working internet access 
# No vmware tools installed yet 
# We are logged in as root

# Shared folder is enabled and specified
# !IMPORTANT Shared folder name is islandsData


#mkdir /mnt/hgfs

#apt update
#apt install open-vm-tools -y 
#apt install open-vm-tools-desktop -y


# Creating rc.local

echo  "#!/bin/sh -e
" >> /etc/vmware-mount.local

chmod +x /etc/vmware-mount.local

echo "[Unit]
 Description=Automount vmware shared folder with permissions
 ConditionPathExists=/etc/vmware-mount.local

 
[Service]
 Type=oneshot
 ExecStart=/etc/vmware-mount.local start
 TimeoutSec=0
 StandardOutput=tty
 RemainAfterExit=yes
 
[Install]
 WantedBy=multi-user.target
" >> /etc/systemd/system/vmware-mount-local.service


# VMWare automount setup
echo ".host:/ /mnt/hgfs   fuse.vmhgfs-fuse  noauto,allow_other 	0	0" >> /etc/fstab
echo "#!/bin/sh -e
mount /mnt/hgfs
" >> /etc/vmware-mount.local
chown root:root /etc/vmware-mount.local
chmod 0755 /etc/vmware-mount.local


systemctl enable vmware-mount-local.service



