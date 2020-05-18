#!/bin/bash

USAGE="

    ISLANDS RELEASE SCRIPT:

    This script automates islands release and issue of a new .isld file

"

POSITIONAL=()
while [[ $# -gt 0 ]]
do
    key="$1"
    case $key in
        -ip)
            IPADDR="$2"
            shift
            shift
            ;;
        -h|--help)
            HELP=true
            shift
            ;;
    esac
done

if [[ ${HELP} ]]; then
    echo "$USAGE"

    exit 0
fi

if [[ ! ${IPADDR} ]]; then
    echo IP address required
    echo "$USAGE"
    exit 0
fi



COMMAND="

cd &&
ls -a &&
read -p \"I am in guest machine\" &&
exit 0
"

ssh ${IPADDR} -l island $COMMAND

read -p "SSH RETURNED. Press enter to continue"
