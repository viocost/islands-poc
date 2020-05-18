# -*- mode: python -*-

block_cipher = None


a = Analysis(['main.py'],
             pathex=['pyinstaller', 'C:\\Windows\\System32\\downlevel\\', 'D:\\Python\\Python37-32\\Lib\\site-packages' 'D:\\islands\\island-manager'],
             binaries=[],
             datas=[('.\\os_defaults\\', 'os_defaults'),  ('.\\docs\\', 'docs'), ('.\\resources\\', 'resources'), ('default_config.json', '.'), ('version', '.')],
             hiddenimports=['sip, cffi'],
             hookspath=[],
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=block_cipher,
             noarchive=False)
pyz = PYZ(a.pure, a.zipped_data,
             cipher=block_cipher)
exe = EXE(pyz,
          a.scripts,
          [],
          exclude_binaries=True,
          name='islands',
          debug=False,
          bootloader_ignore_signals=False,
          strip=False,
          upx=True,
          console=False , icon='island.ico')
coll = COLLECT(exe,
               a.binaries,
               a.zipfiles,
               a.datas,
               strip=False,
               upx=True,
               name='islands')
