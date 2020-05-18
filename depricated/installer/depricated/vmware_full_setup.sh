#!/bin/bash
# Origin state:
# Assuming we have clean Debian installation with working internet access 
# No vmware tools installed yet 
# We are logged in as root

# Shared folder is enabled and specified
# !IMPORTANT Shared folder name is islandsData



BRANCH="master"

USAGE="

    ISLANDS SETUP OPTIONS:

    -b | --branch
    specific branch to pull code from

    -h | --help
    Print help message
"

if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi


POSITIONAL=()
while [[ $# -gt 0 ]]

do
key="$1"

case $key in
    -b | --branch)
    BRANCH="$2"
    shift
    shift
    ;;
    -h | --help)
    HELP=true
    shift
    ;;
esac
done


if [[ ${HELP} ]]; then
    echo "$USAGE";
    exit 0;
fi



mkdir /mnt/hgfs

apt update
apt install open-vm-tools -y 
apt install open-vm-tools-desktop -y


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
echo ".host:/ /mnt/hgfs   fuse.vmhgfs-fuse  noauto,allow_other  0   0" >> /etc/fstab
echo "#!/bin/sh -e
mount /mnt/hgfs
" >> /etc/vmware-mount.local
chown root:root /etc/vmware-mount.local
chmod 0755 /etc/vmware-mount.local


systemctl enable vmware-mount-local.service

# ASSUMPTIONS AT THIS POINT
# 1. Guest additions have been installed
# 2. Internet connection is enabled
# 3. Running script as root
# 4. User island exists in the system
# 5. Group islands exists



apt install dirmngr
apt install unzip

echo Installing Node.JS
apt install curl -y
apt install apt-transport-https -y
curl -sL https://deb.nodesource.com/setup_10.x | bash -
apt install -y nodejs

echo Installing TOR
echo 'deb https://deb.torproject.org/torproject.org stretch main' | tee -a /etc/apt/sources.list
echo 'deb-src https://deb.torproject.org/torproject.org stretch  main' | tee -a /etc/apt/sources.list

curl https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc | gpg --import
gpg --no-tty --export A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89 | apt-key add -

apt update
apt install tor deb.torproject.org-keyring -y
echo Configuring and starting TOR...
phash=$(tor --hash-password 'TheP@$sw0rd' | grep 16\:.*)
echo 'ControlPort 9051' | tee -a /etc/tor/torrc
echo 'HashedControlPassword' $phash | tee -a /etc/tor/torrc
echo 'ExitPolicy reject *:*' | tee -a /etc/tor/torrc
service tor start
echo Tor configuration completed. Launching service...

mkdir /usr/src/app

curl -sL https://github.com/viocost/islands/archive/${BRANCH}.zip -o /tmp/${BRANCH}.zip
cd /tmp
unzip ${BRANCH}.zip
cp islands-${BRANCH}/chat/* /usr/src/app/ -r
cd /usr/src/app/
npm install
npm install -g pm2
pm2 update


#starting app
pm2 start /usr/src/app/server/app.js --node-args="--experimental-worker" -- -c /usr/src/app/server/config/configvmware.json
pm2 save
pm2 startup

echo Installation complete. Restarting...


