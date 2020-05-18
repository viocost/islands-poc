#!/bin/bash

# Make sure to run this from Island Manager root directory
# Assummed that python v3.7 or higher, pip3 and python3-venv are installed

python="python3"
pip="pip3"
USAGE='USAGE:
  run.sh [OPTIONS]

OPTIONS
 -i path to python interpriter, default python3
 -p path to pip, default pip3

 -h print this message and exit
'

while getopts ":p:i:h" o; do
	case "${o}" in 
		p)
			pip=${OPTARG}
			;;
		i)
			python=${OPTARG}
			;;
        h)
            echo "${USAGE}"
            exit 0
            ;;
	esac
done

if [[ ! -f $python  ]] &&  ! ls /usr/bin | grep -q  "^${python}$" && ! ls /usr/local/bin | grep -q  "^${python}$"; then
       echo Python interpriter has not been found.	
       exit 1
fi

if [[ ! -f $pip  ]] &&  ! ls /usr/bin | grep -q  "^${pip}$" && ! ls /usr/local/bin | grep -q  "^${pip}$"; then
       echo Python interpriter has not been found.	
       exit 1
fi

if [ ! -d "./venv" ]; then
    echo creating virtual environment
    mkdir venv
    $python -m venv ./venv
    
fi

source ./venv/bin/activate 
$pip install -r requirements.txt


if [[ $1 == "--debug" ]]; then
    echo Running in debug mode
    $python ./main.py --debug
else
    echo Running in normal mode
    $python ./main.py
fi


deactivate

