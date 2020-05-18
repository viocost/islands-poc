#!/usr/bin/env bash

echo About to install services.
sleep 3

echo "
#!/bin/bash

if [ ! -f /root/already_ran ]; then
   sleep 5;
   if [ -f /media/sf_islandsData/god.key ]; then
      if [ ! -d /home/island/.ssh ]; then
          mkdir /home/island/.ssh;
      fi
      cat /media/sf_islandsData/god.key >> /home/island/.ssh/authorized_keys
      chmod 700 /home/island/.ssh;
      chmod 600 /home/island/.ssh/authhorized_keys;
      chown -R island:island /home/island/.ssh;
   fi

   touch /root/already_ran;

fi

exit 0
" >> /root/startup.sh

chmod +x /root/startup.sh

echo "
[Unit]
Description=Island startup sript

[Service]
ExecStart=/root/startup.sh

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
ExecStart=/root/stats.sh

[Install]
WantedBy=multi-user.target
" >> /etc/systemd/system/island-stats.service

systemctl enable island-stats.service
echo stats service should be now enabled
sleep 3

echo Installation complete!
