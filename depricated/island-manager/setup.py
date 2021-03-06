"""
This is a setup.py script generated by py2applet

Usage:
    python setup.py py2app
"""

from setuptools import setup

APP = ['main.py']

DATA_FILES = [
    'resources/images/icon.icns',
    'os_defaults/linux.json',
    'os_defaults/mac.json',
    'os_defaults/windows.json',
    'default_config.json',
    'resources/icons/stop.png',
    'resources/icons/play.png',
    'resources/icons/torrents.png',
    'resources/icons/plus-minus.png',
    'resources/icons/exit.svg',
    'docs/user_guide.md',
    'version'
]
PLIST = {'CFBundleDisplayName': 'Islands', 'CFBundleName': 'Islands'}
OPTIONS = {
    'iconfile': 'resources/images/icon.icns',
    'plist': PLIST,
    'resources': ['os_defaults', 'docs', "resources"],
    'includes': ['sip', 'PyQt5']
}

setup(
    app=APP,
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)

"""
WARNING!!!
When invoking from command line - include --packages="PyQt5"
    
    $ python3 setup.py py2app --packages="PyQt5"

"""