#!/bin/bash
#
#This script updates Islands apps and services within a given directory


declare -a ISLANDS

while [[ $# -gt 0 ]]

do
key="$1"

case $key in
    -p|--path)
    ISLANDS+=(${2})
    shift
    shift
    ;;
    -bf|--build-front)
    BUILD_FRONT=true
    shift
    ;;
    -h | --help)
    HELP=true
    shift
    ;;
esac
done

[[ $BUILD_FRONT ]] && {
    echo building front
    npm run build-front || {
        echo Unable to compile front end. Exiting...
        exit 1
    }
}


CHAT_SOURCE_PATH=$(readlink -f $(pwd))
ENGINE_PATH=$(readlink -f $(pwd)/../core/services/engine)
DRIVERS_PATH=$(readlink -f $(pwd)/../core/drivers)


for IPATH in ${ISLANDS[@]}; do
    echo Updating island at ${IPATH}...


    [[ -d "$IPATH" ]] && [[ -d ${IPATH}/apps ]] && [[ -d ${IPATH}/apps/chat ]] || {
        echo Islands distribution is invalid.
        echo Exiting
        continue
    }

    APPS_PATH="${IPATH}/apps"

    cp -r $CHAT_SOURCE_PATH $APPS_PATH
    cp -r $ENGINE_PATH $APPS_PATH
    cp -r ${DRIVERS_PATH}/*  $IPATH

    echo Island at ${IPATH} updated.
done
