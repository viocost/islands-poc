#!/bin/bash
# This runs islands chat with docker

USAGE="

    ISLANDS RUN OPTIONS:

    -p | --port
    Port number your island will be listening on

    -df | --data-folder
    Path to Island data store directory
    If not specified -
    script will create islandsData
    directory in-place

    -db | --debug
    Debug mode

    -dp | --debug-port
    Port number for attaching local debugger

    -bf | --build-front
    Run npm script to re-build front end
"


POSITIONAL=()
while [[ $# -gt 0 ]]

do
key="$1"

case $key in
    -p|--port)
    PORT="$2"
    shift
    shift
    ;;
    -dp|--debug-port)
    DEBUGPORT="$2"
    shift
    shift
    ;;
    -df|--data-folder)
    DATAFOLDER="$2"
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
    -ip)
    IPADDR="$2"
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

if [[ ${BUILD_FRONT} ]]; then 
    echo building front
    npm run build-front;
fi

RUNCOMMAND="docker container run --rm -it "

if [ [ -z ${IPADDR} ] ]; then
    IPADDR="localhost"
else
    RUNCOMMAND= "$RUNCOMMAND -ip ${IPADDR} "
fi

if [[ -z ${PORT+x} ]]; then
    PORT=4001;
fi
RUNCOMMAND="$RUNCOMMAND -p ${PORT}:4000 "

if [[ ! -z  ${DEBUG+x} ]]; then
    if [[ -z ${DEBUGPORT+x} ]]; then
        DEBUGPORT=9229;
    fi
    RUNCOMMAND=" $RUNCOMMAND -p ${DEBUGPORT}:9229 ";
fi


if [[ -z  ${DATAFOLDER+x} ]]; then
    mkdir -p islandsData ;
    DATAFOLDER="${PWD}/islandsData" ;
fi

RUNCOMMAND="$RUNCOMMAND  --mount type=bind,source=${DATAFOLDER},target=/islandsData  islands:chat"


docker build -f Dockerfile -t islands:chat .
eval "$RUNCOMMAND"
