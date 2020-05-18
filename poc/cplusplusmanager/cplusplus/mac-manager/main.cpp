#include "mainwindow.h"
#include <QApplication>
#include <QMessageBox>



int main(int argc, char *argv[])
{
    QApplication a(argc, argv);
    a.setStyle("material");
    MainWindow w;
    w.show();

    return a.exec();
}
