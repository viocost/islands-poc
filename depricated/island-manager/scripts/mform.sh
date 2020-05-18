#!/bin/bash

function do_main {
    echo doing main
    pyuic5 ../views/main_form/main_form.ui -o ../views/main_form/main_form.py
    echo done!
}

function do_logs {
    echo doing logs form
    pyuic5 ../views/logs_form/logs_form.ui -o ../views/logs_form/logs_form.py
    echo done!
}

function do_image_authoring_form {
    echo doing image_authoring_form
    pyuic5 ../views/image_authoring_form/image_authoring_form.ui -o ../views/image_authoring_form/image_authoring_form.py
    echo done!
}

function do_config_form {
    echo doing config_form
    pyuic5 ../views/config_form/config_form.ui -o ../views/config_form/config_form.py
    echo done!
}

function do_import_key_form {
    echo doing import_key_form
    pyuic5 ../views/import_key_form/import_key_form.ui -o ../views/import_key_form/import_key_form.py
    echo done!
}

function do_key_create_form {
    echo doing key_create_form
    pyuic5 ../views/key_create_form/key_create_form.ui -o ../views/key_create_form/key_create_form.py
    echo done!
}


function do_keys_form {
    echo doing keys_form
    pyuic5 ../views/keys_form/keys_form.ui -o ../views/keys_form/keys_form.py
    echo done!
}

function do_help_form {
    echo doing help_form
    pyuic5 ../views/help_form/help_form.ui -o ../views/help_form/help_form.py
    echo done!
}

function do_setup_form {
    echo doing setup
    pyuic5 ../views/setup_wizard/setup_wizard.ui -o ../views/setup_wizard/setup_wizard.py
    echo done!
}


function do_torrents_form {
    echo doing torrents_form
    pyuic5 ../views/torrents_form/torrents_form.ui -o ../views/torrents_form/torrents_form.py
    echo done!
}


function do_update_form {
    echo doing update_form
    pyuic5 ../views/update_form/update_form.ui -o ../views/update_form/update_form.py
    echo done!
}

function do_select_vm_form {
    echo doing select_vm_form
    pyuic5 ../views/select_vm_form/select_vm_form.ui -o ../views/select_vm_form/select_vm_form.py
    echo done!
}



if [[ $1 == "main" ]]; then
    do_main
elif [[ $1 == "image_author" ]]; then
    do_image_authoring_form
elif [[ $1 == "config" ]]; then
    do_config_form
elif [[ $1 == "key_import" ]]; then
    do_import_key_form
elif [[ $1 == "key_create" ]]; then
    do_key_create_form
elif [[ $1 == "logs" ]]; then
    do_logs
elif [[ $1 == "keys" ]]; then
    do_keys_form
elif [[ $1 == "help" ]]; then
    do_help_form
elif [[ $1 == "setup" ]]; then
    do_setup_form
elif [[ $1 == "torrents" ]]; then
    do_torrents_form
elif [[ $1 == "update" ]]; then
    do_update_form
elif [[ $1 == "select_vm" ]]; then
    do_select_vm_form
elif [[ $1 == "all" ]]; then
    do_main
    do_image_authoring_form
    do_help_form
    do_config_form
    do_torrents_form
    do_setup_form
    do_keys_form
    do_update_form
    do_import_key_form
else
    echo Unknown form!
fi

