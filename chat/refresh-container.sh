#!/bin/bash

# This script refreshes islands source code within the running container
# This allows refresh source without restarting tor and re-launching hidden services

POSITIONAL=()
while [[ $# -gt 0 ]]
do
    key="$1"

    case $key in
        -bf|--build-front)
            BUILD_FRONT=true
            shift
            ;;
        -c|--container)
            CONTAINER_NAME="$2"
            shift
            shift
            ;;
        -ba|--build-admin)
            BUILD_ADMIN=ture
            shift
            ;;
        -bv|--build-vault)
            BUILD_VAULT=ture
            shift
            ;;
        -bc|--build-chat)
            BUILD_CHAT=true
            shift
            ;;
    esac
done

if [[ ! ${CONTAINER_NAME} ]]; then
    echo Container name is required! Exiting...
    exit 0;
fi


if [[ ${BUILD_ADMIN} ]]; then
    SELECTIVE_BUILD=true;
    echo Building admin...
    npm run build-admin;
fi

if [[ ${BUILD_VAULT} ]]; then
    SELECTIVE_BUILD=true;
    echo Building vault...
    npm run build-vault;
fi

if [[ ${BUILD_CHAT} ]]; then
    SELECTIVE_BUILD=true;
    echo Building chat...
    npm run build-chat;
fi

if [[ ${BUILD_FRONT} ]]; then
    echo Building front...
    if  [[ ! $SELECTIVE_BUILD ]]; then
        npm run build-front;
    else
        echo Selective build enabled
    fi
fi


docker exec -it ${CONTAINER_NAME} rm -rf *
docker cp ./ ${CONTAINER_NAME}:/usr/src/app
docker exec -it ${CONTAINER_NAME} pm2 restart 0

echo All set!
