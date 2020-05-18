#include <QApplication>
#include <QMessageBox>
#include "mainwindow.h"


int main(int argc, char *argv[])
{
    QApplication a(argc, argv);

    if(!QSystemTrayIcon::isSystemTrayAvailable()){
        QMessageBox::critical(NULL, QObject::tr("Systray"),
                                      QObject::tr("I couldn't detect any system tray "
                                                  "on this system."));
                return 1;
    }
    a.setStyle("material");
    MainWindow w;
    w.show();
    return a.exec();
}
