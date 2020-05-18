#! /bin/bash
#
# vbox_full_setup.sh
#
# Distributed under terms of the MIT license.
#


# ASSUMPTIONS AT THIS POINT
# 1. Guest additions have been installed
# 2. Internet connection is enabled
# 3. Running script as root
# 4. There exists user island



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
    -e | --enable-optimizations)
    OPTIMIZE=true
    shift
    ;;
esac
done


if [[ ${HELP} ]]; then
    echo "$USAGE";
    exit 0;
fi

echo INSTALLING FROM ${BRANCH}

apt update -y
apt install dirmngr -y
apt install unzip -y


apt install curl -y
apt install apt-transport-https -y


echo Installing TOR
echo 'deb https://deb.torproject.org/torproject.org stretch main' | tee -a /etc/apt/sources.list
echo 'deb-src https://deb.torproject.org/torproject.org stretch  main' | tee -a /etc/apt/sources.list

curl https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc | gpg --import
gpg --no-tty --export A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89 | apt-key add -

apt update
apt install tor deb.torproject.org-keyring -y
echo Configuring and starting TOR...
phash=$(tor --quiet --hash-password 'TheP@$sw0rd' | egrep -o 16\:.{58})
sleep 1s
echo 'ControlPort 9051' | tee -a /etc/tor/torrc
sleep 1s
echo 'HashedControlPassword' $phash | tee -a /etc/tor/torrc
sleep 1s
echo 'ExitPolicy reject *:*' | tee -a /etc/tor/torrc
sleep 1s
echo Tor configuration completed. Launching service...
sleep 1s
service tor start

echo Installing Node.JS
curl -sL https://deb.nodesource.com/setup_13.x | bash -
apt-get install -y nodejs

# mkdir /usr/src/app

# curl -sL https://github.com/viocost/islands/archive/${BRANCH}.zip -o /tmp/${BRANCH}.zip
# cd /tmp
# unzip ${BRANCH}.zip
# cp islands-${BRANCH}/chat/* /usr/src/app/ -r
# cd /usr/src/app/

apt install build-essential zlib1g-dev libncurses5-dev libgdbm-dev libnss3-dev libssl-dev libreadline-dev libffi-dev -y

wget  https://www.python.org/ftp/python/3.7.3/Python-3.7.3.tar.xz
tar -xf Python-3.7.3.tar.xz

cd Python-3.7.3
if [[ ${OPTIMIZE} ]]; then
    ./configure --enable-optimizations
else
    ./configure
fi

make
make install
update-alternatives --install /usr/bin/python3 python3 /usr/local/bin/python3 10

cd ../
mv /usr/bin/lsb_release /usr/bin/lsb_release.bak

wget https://bootstrap.pypa.io/get-pip.py
python3 get-pip.py


npm install -g pm2
pm2 update

# installing redis
apt install redis-server -y

# qbittorrent-nox install and configure
apt install qbittorrent-nox -y

echo "[Unit]
Description=qBittorrent Daemon Service
Documentation=man:qbittorrent-nox(1)
Wants=network-online.target
After=network-online.target nss-lookup.target

[Service]
# if you have systemd >= 240, you probably want to use Type=exec instead
Type=simple
User=qbtuser
ExecStart=/usr/bin/qbittorrent-nox
TimeoutStopSec=infinity

[Install]
WantedBy=multi-user.target
" > /etc/systemd/system/qbittorrent.service


#starting app

# pm2 start /usr/src/app/server/app.js --node-args="--experimental-worker" -- -c /usr/src/app/server/config/configvbox.json
# pm2 save
# pm2 startup



# Services installation and disabling terminals (skipping for now)
exit 0

echo About to install services.
sleep 3

echo "
#!/bin/bash

# checking if trusted key is supplied
if [ ! -f /root/already_ran ]; then
   while true
   do
       if (( \$(mount | egrep -c islandsData) > 0 )); then
           sleep 5
           if [ -f /media/sf_islandsData/god.key ]; then
              if [ ! -d /home/island/.ssh ]; then
                  mkdir /home/island/.ssh;
              fi
              cat /media/sf_islandsData/god.key >> /home/island/.ssh/authorized_keys
              chmod 700 /home/island/.ssh;
              chmod 600 /home/island/.ssh/authorized_keys;
              chown -R island:island /home/island/.ssh;
          fi
          break
       fi
       sleep 4
   done
   touch /root/already_ran;
fi

# Checking for the source code.
if (( \$(mount | egrep -c islandsData) > 0 )); then
   if [ -f /media/sf_islandsData/source.zip ]; then
      # copy to temp
      # unpack
      # verify
      # copy to the working dir
      # launch pm2
   fi
fi

exit 0
" >> /root/startup.sh

chmod +x /root/startup.sh

echo "
[Unit]
Description=Island startup sript

[Service]
ExecStart=/bin/bash /root/startup.sh

[Install]
WantedBy=multi-user.target
" >> /etc/systemd/system/island-startup.service

echo Startup script set up. Activating service...

systemctl enable island-startup.service

echo setting up stats service
sleep 1
echo "
while true
do
    if [ -d /media/sf_islandsData ]; then
       ip a > /media/sf_islandsData/stats
       sleep 1
    fi
done
" >> /root/stats.sh

chmod +x /root/stats.sh

echo "
[Unit]
Description=Island stats service

[Service]
ExecStart=/bin/bash /root/stats.sh

[Install]
WantedBy=multi-user.target
" >> /etc/systemd/system/island-stats.service

systemctl enable island-stats.service

echo stats service should be now enabled
sleep 3
echo disabling password authentification...
echo 'PasswordAuthentication no' | tee -a /etc/ssh/sshd_config
systemctl restart ssh
sed -i -e "s/island:.*/island:!YTREWQbca:17969:0:99999:7:::/" /etc/shadow
systemctl disable getty@tty1.service

echo Installation complete!
echo On next boot system will scan for ssh public key. The file should be placed in shared folder and should be named god.key
echo If file is not found - it will be not possible to login into the Island vm.
