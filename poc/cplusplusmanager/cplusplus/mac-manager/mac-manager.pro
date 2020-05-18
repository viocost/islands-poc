#-------------------------------------------------
#
# Project created by QtCreator 2018-10-17T16:08:48
#
#-------------------------------------------------

QT       += core gui

greaterThan(QT_MAJOR_VERSION, 4): QT += widgets

TARGET = mac-manager
TEMPLATE = app

# The following define makes your compiler emit warnings if you use
# any feature of Qt which has been marked as deprecated (the exact warnings
# depend on your compiler). Please consult the documentation of the
# deprecated API in order to know how to port your code away from it.
DEFINES += QT_DEPRECATED_WARNINGS

# You can also make your code fail to compile if you use deprecated APIs.
# In order to do so, uncomment the following line.
# You can also select to disable deprecated APIs only up to a certain version of Qt.
#DEFINES += QT_DISABLE_DEPRECATED_BEFORE=0x060000    # disables all the APIs deprecated before Qt 6.0.0

CONFIG += c++11

SOURCES += \
        main.cpp \
        mainwindow.cpp \
        islandmanager.cpp \
        iutil.cpp \
        config.cpp



HEADERS += \
        rapidjson/error/en.h \
        rapidjson/error/error.h \
        rapidjson/internal/biginteger.h \
        rapidjson/internal/diyfp.h \
        rapidjson/internal/dtoa.h \
        rapidjson/internal/ieee754.h \
        rapidjson/internal/itoa.h \
        rapidjson/internal/meta.h \
        rapidjson/internal/pow10.h \
        rapidjson/internal/regex.h \
        rapidjson/internal/stack.h \
        rapidjson/internal/strfunc.h \
        rapidjson/internal/strtod.h \
        rapidjson/internal/swap.h \
        rapidjson/msinttypes/inttypes.h \
        rapidjson/msinttypes/stdint.h \
        rapidjson/allocators.h \
        rapidjson/cursorstreamwrapper.h \
        rapidjson/document.h \
        rapidjson/encodedstream.h \
        rapidjson/encodings.h \
        rapidjson/filereadstream.h \
        rapidjson/filewritestream.h \
        rapidjson/fwd.h \
        rapidjson/istreamwrapper.h \
        rapidjson/memorybuffer.h \
        rapidjson/memorystream.h \
        rapidjson/ostreamwrapper.h \
        rapidjson/pointer.h \
        rapidjson/prettywriter.h \
        rapidjson/rapidjson.h \
        rapidjson/reader.h \
        rapidjson/schema.h \
        rapidjson/stream.h \
        rapidjson/stringbuffer.h \
        rapidjson/writer.h \
        mainwindow.h \
        islandmanager.h \
        iutil.h \
        config.h \




FORMS += \
        mainwindow.ui \
    islandnamerequest.ui

# Default rules for deployment.
qnx: target.path = /tmp/$${TARGET}/bin
else: unix:!android: target.path = /opt/$${TARGET}/bin
!isEmpty(target.path): INSTALLS += target

RC_ICONS = island.ico

RESOURCES += \
    resources.qrc

DISTFILES +=
