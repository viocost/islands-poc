#!/bin/bash
#
#This script prepares islands source code
#Path to pem key and to source code must be provided as command line arguments
#
#


while getopts ":k:s:" opt
do
    case $opt in
        k) KEY=${OPTARG}  ;;
        s) SOURCE=${OPTARG} ;;
        *) echo "Invalid option! " ${opt};;
    esac
done

echo "Key is ${KEY}"
echo "Source is ${SOURCE}"

if [[ ! -d ${SOURCE} ]]; then
    echo Source directory does not exist: ${SOURCE}
    exit 1
fi

# zipping source directory
echo Packing source...
zip source.zip ${SOURCE} -r
echo Signing...
gpg2 -u ${KEY} --detach-sign source.zip

echo Creting an Islands package
zip islands.zip source.zip source.zip.sig


echo Cleaning up...
rm source.zip source.zip.sig

echo All set!
