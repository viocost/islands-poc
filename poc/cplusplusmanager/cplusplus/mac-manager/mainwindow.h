#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <qsystemtrayicon.h>
#include "islandmanager.h"

namespace Ui {
class MainWindow;
}

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

protected:
        void closeEvent(QCloseEvent * event);

private slots:
    void iconActivated(QSystemTrayIcon::ActivationReason reason);
    void on_shutdownIslandButton_clicked();
    void on_launchIslandButton_clicked();
    void on_restartIslandButton_clicked();


    void on_vboxmanagePathLineEdit_textChanged(const QString &arg1);


    void on_pushButton_clicked();



private:
    Ui::MainWindow *ui;
    QSystemTrayIcon *mSystemTrayIcon;
    QAction *minimizeAction;
    QAction *quitAction;
    QAction *launchIslandAction;
    QAction *shudownIslandAction;
    QAction *restartIslandAction;
    QMenu *trayIconMenu;
    IslandManager *islandManager;

    void update_island_status();
    void reload_ettings();
};

#endif // MAINWINDOW_H
