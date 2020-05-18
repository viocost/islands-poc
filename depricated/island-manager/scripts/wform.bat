@echo off


SET form=%1

if "%form%" == "" (
    echo Form name must be provided!
    exit /b -1
)

if "%form%" == "main" (
    echo main form
    pyuic5 ..\views\main_form\main_form.ui -o ..\views\main_form\main_form.py
    echo Done!

)

if "%form%" == "import_key" (
    echo import_key form

    pyuic5 ..\views\import_key_form\import_key_form.ui -o ..\views\import_key_form\import_key_form.py
    echo Done!

)

if "%form%" == "create_key" (
    echo create_key form
    pyuic5 ..\views\key_create_form\key_create_form.ui -o ..\views\key_create_form\key_create_form.py
    echo Done!
)


if "%form%" == "authoring" (
    echo creating image_authoring_form
    pyuic5 ..\views\image_authoring_form\image_authoring_form.ui -o ..\views\image_authoring_form\image_authoring_form.py
    echo Done!
)


if "%form%" == "create_torrent" (
    echo creating create_torrent_form
    pyuic5 ..\views\create_torrent_form\create_torrent_form.ui -o ..\views\create_torrent_form\create_torrent_form.py
    echo Done!
)


if "%form%" == "setup" (
    echo creating setup_wizard_form
    pyuic5 ..\views\setup_wizard\setup_wizard.ui -o ..\views\setup_wizard\setup_wizard_ui_setup.py
    echo Done!
)


if "%form%" == "torrent" (
    echo creating torrents_form
    pyuic5 ..\views\torrents_form\torrents_form.ui -o ..\views\torrents_form\torrents_form.py
    echo Done!
)





if "%form%" == "keys" (
    echo creating keys_form
    pyuic5 ..\views\keys_form\keys_form.ui -o ..\views\keys_form\keys_form.py
    echo Done!
)




if "%form%" == "config" (
    echo creating config_form
    pyuic5 ..\views\config_form\config_form.ui -o ..\views\config_form\config_form.py
    echo Done!
)



