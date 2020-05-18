#!/bin/bash


POSITIONAL=()
while [[ $# -gt 0 ]]

do
key="$1"

case $key in
    -b|--branch)
    BRANCH="$2"
    shift
    shift
    ;;
esac
done

if [[ ${BRANCH} == "dev" ]]; then
    echo "FETCHING FROM DEV BRANCH"
    DOWNLOADCOMMAND="curl -L https://github.com/viocost/islands/archive/dev.zip -o /tmp/islands/chat.zip"
    MVCOMMAND="mv /tmp/islands/islands-dev/chat/* /usr/src/app/"
else
    echo "FETCHING FROM MASTER BRANCH"
    DOWNLOADCOMMAND="curl -L https://github.com/viocost/islands/archive/master.zip -o /tmp/islands/chat.zip"
    MVCOMMAND="mv /tmp/islands/islands-master/chat/* /usr/src/app/"
fi

mkdir /tmp/islands
echo "$DOWNLOADCOMMAND"
eval "$DOWNLOADCOMMAND"
unzip /tmp/islands/chat.zip -d /tmp/islands/


rm -rf /usr/src/app/*
eval "$MVCOMMAND"
rm -rf /tmp/islands
cd  /usr/src/app
npm install
npm run build-front
chmod +x /usr/src/app/scripts/update.sh
sed -i -e 's/\r$//' /usr/src/app/scripts/update.sh
chmod +x /usr/src/app/scripts/updategh.sh
sed -i -e 's/\r$//' /usr/src/app/scripts/updategh.sh

