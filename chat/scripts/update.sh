#!/bin/bash

rm -rf /usr/src/app/*
unzip /islandsData/update/chat.zip -d /usr/src/app/
cd  /usr/src/app
npm install
npm run build-front
npm prune --production
chmod +x /usr/src/app/scripts/update.sh
sed -i -e 's/\r$//' /usr/src/app/scripts/update.sh
chmod +x /usr/src/app/scripts/updategh.sh
sed -i -e 's/\r$//' /usr/src/app/scripts/updategh.sh
rm -f /islandsData/update/chat.zip
