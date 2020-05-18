#include <iostream>
#include <QCloseEvent>
#include <QStyle>
#include <QMessageBox>

#include "mainwindow.h"
#include "ui_mainwindow.h"

#include "islandmanager.h"

MainWindow::MainWindow(QWidget *parent) :
    QMainWindow(parent),
    ui(new Ui::MainWindow)
{
    ui->setupUi(this);
    mSystemTrayIcon = new QSystemTrayIcon(this);
    mSystemTrayIcon->setIcon(QIcon(":/images/island.png"));
    mSystemTrayIcon->setToolTip("Island Manager tray" "\n"
                                    "Another line");
    this->islandManager = new IslandManager();
    QMenu * menu = new QMenu(this);
    QAction * viewWindow = new QAction("Show manager", this);
    QAction * exitIslandManager = new QAction("Exit", this);

    connect(viewWindow, SIGNAL(triggered()), this, SLOT(show()));
    connect(exitIslandManager, SIGNAL(triggered()), this, SLOT(close()));

    menu->addAction(viewWindow);
    menu->addAction(exitIslandManager);

    mSystemTrayIcon->setContextMenu(menu);
    mSystemTrayIcon->show();

    connect(mSystemTrayIcon, SIGNAL(activated(QSystemTrayIcon::ActivationReason)),
                this, SLOT(iconActivated(QSystemTrayIcon::ActivationReason)));

    reload_ettings();
}

MainWindow::~MainWindow()
{
    delete ui;
    delete islandManager;
}


void MainWindow::iconActivated(QSystemTrayIcon::ActivationReason reason)
{

    std::cout<<"Icon activated\n"<<reason;
}

void MainWindow::closeEvent(QCloseEvent * event)
{

    if(this->isVisible()) {
        event->ignore();
        this->hide();
        QSystemTrayIcon::MessageIcon icon = QSystemTrayIcon::MessageIcon(QSystemTrayIcon::Information);
        mSystemTrayIcon->showMessage("Island manager", "Island manager has been minimized", icon, 2000);
    }
}

void MainWindow::on_launchIslandButton_clicked()
{
    this->islandManager->launchIsland();
    this->update_island_status();
}

void MainWindow::on_shutdownIslandButton_clicked()
{
    this->islandManager->shutdownIsland();
    this->update_island_status();
}

void MainWindow::on_restartIslandButton_clicked()
{
    this->islandManager->restartIsland();
    this->update_island_status();
}


void MainWindow::update_island_status(){
    if(this->islandManager->isIslandRunning()){
        ui->islandStatus->setText("Running");
        ui->islandStatus->setStyleSheet("QLabel {color: green;}");
    }else{
        ui->islandStatus->setText("Not running");
        ui->islandStatus->setStyleSheet("QLabel {color: red;}");
    }
}


void MainWindow::reload_ettings(){
    std::string vmName = this->islandManager->get_vmname();
    std::string vmid = "unknown";
    std::string vboxmanagePath = this->islandManager->get_vbox_path();
    ui->vmnameLineEdit->setText(QString::fromStdString(vmName.empty() ? "unknown" : vmName));
    ui->vmidLineEdit->setText(QString::fromStdString(vmid.empty() ? "unknown" : vmid));
    ui->vboxmanagePathLineEdit->setText(QString::fromStdString(vboxmanagePath.empty() ? "unknown" : vboxmanagePath));
}


//TODO

void MainWindow::on_pushButton_clicked()
{
    QMessageBox::StandardButton reply;
      reply = QMessageBox::question(this, "Reset settings", "Would you like yo restore all settings defaults?",
                                    QMessageBox::Yes|QMessageBox::No);
      if (reply == QMessageBox::Yes) {
          this->islandManager->restore_config_defaults();
          this->reload_ettings();
      } else { /* Do nothing*/ }

}

void MainWindow::on_vboxmanagePathLineEdit_textChanged(const QString &arg1)
{
    std::cout<<"Setting vboxmanage path";
    std::string v = arg1.toStdString();
    this->islandManager->set_vbox_path(v);
}
