
!include "MUI2.nsh"

;Name and file
Name "Islands Manager"
OutFile "IslandsManager.exe"


; Here stuff will be unpacked
InstallDir $PROGRAMFILES\Islands


;Get installation folder from registry if available
InstallDirRegKey HKCU "Software\Islands" ""

RequestExecutionLevel admin


!define MUI_ICON ".\island.ico"

;Shortcut creation
    Function finishpageaction
        CreateShortcut "$desktop\Islands.lnk" "$INSTDIR\islands.exe"
    FunctionEnd
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_CHECKED
  !define MUI_FINISHPAGE_SHOWREADME_TEXT  "Create Desktop Shortcut"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION finishpageaction

;-----------------

;Interface Settings

  !define MUI_ABORTWARNING

;--------------------------------


;Pages

  !insertmacro MUI_PAGE_LICENSE ".\license.txt"
  !insertmacro MUI_PAGE_DIRECTORY
  !insertmacro MUI_PAGE_INSTFILES
  !insertmacro MUI_PAGE_FINISH
  !insertmacro MUI_UNPAGE_CONFIRM
  !insertmacro MUI_UNPAGE_INSTFILES
;



;Languages
 
  !insertmacro MUI_LANGUAGE "English"

;--------------------------------


Section "Install"
      SetOutPath "$INSTDIR"
    File /r /x config.json .\dist\islands\*
    


    ;Store installation folder
    WriteRegStr HKCU "Software\Islands" "" $INSTDIR
    
    ;Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"

SectionEnd


Section "Uninstall"

  ;ADD YOUR OWN FILES HERE...

 
  Delete "$desktop\Islands.lnk"

  RMDir /r "$INSTDIR"

  DeleteRegKey /ifempty HKCU "Software\Islands"

SectionEnd


