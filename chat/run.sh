#!/bin/bash
#
# This script is for development work only
#



USAGE="
This script is for dev work only
It replaces chat source and engine source in core directory
provided as -p argument and launches linux.sh.

USAGE:
./run.sh -p <path/to/core> [ OPTIONS ]

-p, --p Path to islands core. This parameter is required.

-db, --debug Run in debug mode

-bf, --build-front Run build front script before running to recompile front-end

-h, --help print this message
"


while [[ $# -gt 0 ]]

do
key="$1"

case $key in
    -p|--path)
    CORE_PATH="$2"
    shift
    shift
    ;;
    --chat-port)
    CHAT_PORT="$2"
    shift
    shift
    ;;
    --prompt)
    export PROMPT="$2"
    shift
    shift
    ;;
    -db|--debug)
    DEBUG=true
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

if [[ $HELP ]]; then
    echo $USAGE
    exit 0
fi

# Assuming new core structure
# CORE_PATH is path to islands root
# Setting other paths


RUN=${CORE_PATH}/linux.sh
if [[ ! -f ${RUN} ]]; then
    echo "Run file not found inside the core"
    exit 1
fi
[[ ! -z $CHAT_PORT  ]] && RUN="${RUN} -p ${CHAT_PORT}" && echo RUN COMMAND IS ${RUN}
[[ ! -z $DEBUG ]] && RUN="${RUN} -d"  && echo RUN COMMAND IS ${RUN}
APPS_PATH=${CORE_PATH}/apps
CHAT_PATH=${APPS_PATH}/chat
ENGINE_PATH=${APPS_PATH}/engine
CHAT_SOURCE_PATH=$(readlink -f .)

ENGINE_SOURCE_PATH=${CHAT_SOURCE_PATH}/../core/services/engine
DRIVERS_SOURCE_PATH=${CHAT_SOURCE_PATH}/../core/drivers




if [[ ! -d ${CORE_PATH} ]]; then
    echo "Islands core path not found"
    exit 1
fi


if [[ ! -d  ${APPS_PATH} ]]; then
    echo "Apps path not found instde the core"
    exit 1
fi


if [[ $BUILD_FRONT ]]; then
    npm run build-front
    # npm prune --production
fi

cp -r $CHAT_SOURCE_PATH $APPS_PATH
cp -r $ENGINE_SOURCE_PATH $APPS_PATH
cp -r ${DRIVERS_SOURCE_PATH}/*  $CORE_PATH

cd $CORE_PATH
${RUN}
