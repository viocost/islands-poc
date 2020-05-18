from sys import platform
import logging

log = logging.getLogger(__name__)


class Commander:
    """This class contains all possible commands for executing in cmd or shell depending on OS"""

    """CMD TEMPLATES"""
    __start_vm = "{vboxmanage} startvm {vmname} {headless}"
    __shutdown_vm = "{vboxmanage} controlvm {vmname} {mode}"
    __vboxmanage_version = "{vboxmanage} -v"
    __list_vms = "{vboxmanage} list vms"
    __vminfo = "{vboxmanage} showvminfo {vmname} --machinereadable"

    __vm_guestproperty = "{vboxmanage} guestproperty get {vmname} {property}"
    __vm_guestproperties = "{vboxmanage} guestproperty enumerate {vmname}"

    __uninstall_vbox = {
        "darwin": """osascript -e 'do shell script "{mpuntpoint}VirtualBox_Uninstall.tool --unattended" with administrator privileges' """
    }
    __install_vbox = {
        "darwin": """osascript -e 'do shell script "installer -pkg {mountpoint}VirtualBox.pkg -target / " with administrator privileges' """,
        "win32": "{distrpath} --silent",
        "linux": "{distrpath} --silent"
    }
    __delete_vbox_distr = {
        "darwin": "rm -rf {distrpath}",
        "win32": "DEL {distrpath} /F /S"
    }

    __mount_vbox_distro = {
        "darwin": "hdiutil attach {distrpath} -mountpoint {mountpoint}"
    }

    __unmount_vbox_distro = {
        "darwin": "hdiutil detach {mountpoint}"
    }
    __ls_on_guest = '{vboxmanage} guestcontrol {vmname} run --exe "/bin/ls" ' \
                    '--username {username} --password {password}  --wait-stdout -- ls "/"'

    __ip_a_eth1_on_guest = '{vboxmanage} guestcontrol {vmname} run --exe "/sbin/ip" ' \
                           '--username  {username} --password {password}   --wait-stdout -- ip a'

    __hostonly_config = '{vboxmanage} hostonlyif ipconfig "{adapter}"'
    __hostonly_create = '{vboxmanage} hostonlyif create '
    __hostonly_setup = '{vboxmanage} modifyvm {vmname} --nic2 hostonly --cableconnected2 on' \
                       ' --hostonlyadapter2 "{adapter}"'
    __hostonly_switch_to_dhcp = '{vboxmanage} hostonlyif ipconfig "{adapter}" --dhcp'
    __hostonly_enable_dhcp = '{vboxmanage} dhcpserver modify --ifname "{adapter}" --enable'

    __import_vm = "{vboxmanage} import {path} --vsys 0 --vmname {vmname}"
    __delete_vm = "{vboxmanage} unregistervm {vmname} --delete"
    __sharedfolder_setup = '{vboxmanage} sharedfolder add {vmname} ' \
                           '--name {shared_folder_name} -hostpath {hostpath} -automount '




    __sharedfolder_remove = '{vboxmanage} sharedfolder remove {vmname} ' \
                            '--name {shared_folder_name}'

    __insert_guest_additions = '{vboxmanage} storageattach {vmname} ' \
                               '--storagectl IDE --port 1 --device 0 ' \
                               '--type dvddrive ' \
                               '--medium {medium}'

    __setup_port_forwarding = '{vboxmanage} controlvm {vmname} natpf1 "r1, tcp, 127.0.0.1, {port},' \
                              ' {island_ip}, 4000"'

    __onvm_get_setup_script = '{vboxmanage} guestcontrol {vmname} run --exe ' \
                              '"/usr/bin/wget" --username {username} ' \
                              '--password {password} --wait-stdout --wait-stderr ' \
                              '-- wget {scripturl} ' \
                              '-O "{onguest_path}"'

    __onvm_chmodx_install_script = '{vboxmanage} guestcontrol {vmname}' \
                                   ' run --exe "/bin/chmod" --username  {username}' \
                                   ' --password {password} --wait-stdout --wait-stderr ' \
                                   '-- chmod +x {onguest_path} '

    __onvm_launch_setup_script = '{vboxmanage} guestcontrol {vmname} ' \
                                 'run --exe "/bin/bash" --username {username} ' \
                                 '--password {password} --wait-stdout --wait-stderr' \
                                 ' -- bash {onguest_path}  {branch}'

    __make_executable = 'chmod +x {filepath}'



    def ip_a_eth1_onguest(self):
        return self.__ip_a_eth1_on_guest.format(
            vboxmanage=self.config['vboxmanage'],
            vmname=self.config['vmname'],
            username=self.config['vm_username'],
            password=self.config["vm_password"]
        )

    def onvm_launch_setup_script(self):
        return self.__onvm_launch_setup_script.format(
            vboxmanage=self.config['vboxmanage'],
            vmname=self.config['vmname'],
            username=self.config['vm_username'],
            password=self.config["vm_password"],
            onguest_path=self.config["onguest_island_setup_script_path"],
            branch=self.config["island_setup_script_branch_param"]
        )

    def onvm_chmodx_install_script(self):
        return self.__onvm_chmodx_install_script.format(
            vboxmanage=self.config['vboxmanage'],
            vmname=self.config['vmname'],
            username=self.config['vm_username'],
            password=self.config["vm_password"],
            onguest_path=self.config["onguest_island_setup_script_path"]
        )

    def onvm_get_setup_script(self):
        return self.__onvm_get_setup_script.format(
            vboxmanage=self.config['vboxmanage'],
            vmname=self.config['vmname'],
            username=self.config['vm_username'],
            password=self.config["vm_password"],
            scripturl=self.config["vbox_island_setup_script_url"],
            onguest_path=self.config["onguest_island_setup_script_path"]
        )

    def setup_port_forwarding(self, island_ip, port):
        return self.__setup_port_forwarding.format(
            vboxmanage=self.config['vboxmanage'],
            vmname=self.config['vmname'],
            island_ip=island_ip,
            port=port
        )

    def __init__(self, config):
        self.config = config

    def start_vm(self, headless=True):
        headless = "--type headless" if headless else ""
        return self.__start_vm.format(
            vboxmanage=self.config['vboxmanage'],
            vmname=self.config['vmname'],
            headless=headless
        )

    def shutdown_vm(self, force=False):
        mode = "poweroff"  #if force else "acpipowerbutton"
        return self.__shutdown_vm.format(
            vboxmanage=self.config['vboxmanage'],
            vmname=self.config['vmname'],
            mode=mode
        )

    def vboxmanage_version(self):
        return self.__vboxmanage_version.format(
            vboxmanage=self.config['vboxmanage']
        )

    def listvms(self):
        return self.__list_vms.format(
            vboxmanage=self.config['vboxmanage']
        )

    def vminfo(self, name=None):
        return self.__vminfo.format(
            vboxmanage=self.config['vboxmanage'],
            vmname=name if name else self.config['vmname']
        )

    def vm_guestproperty(self, property=None, vmname=None):
        if property is None:
            return self.__vm_guestproperties.format(
                vboxmanage=self.config['vboxmanage'],
                vmname=vmname if vmname else self.config['vmname'],
            )
        else:
            return self.__vm_guestproperty.format(
                vboxmanage=self.config['vboxmanage'],
                vmname=vmname if vmname else self.config['vmname'],
                property=property
            )


    def install_vbox(self, path_to_installer):
        mountpoint = "" if 'vbox_distro_mountpoint' not in self.config else self.config['vbox_distro_mountpoint']
        return self.__install_vbox[platform].format(mountpoint=mountpoint,
                                                    distrpath=path_to_installer)

    def uninstall_vbox(self):
        return self.__uninstall_vbox[platform].format(mountpoint=self.config['vbox_distro_mountpoint'])

    def delete_vbox_distro(self, distrpath):
        return self.__delete_vbox_distr[platform].format(distrpath=distrpath)

    def unmount_vbox_distro(self, distrpath):
        return self.__unmount_vbox_distro[platform].format(
            mountpoint=self.config["vbox_distro_mountpoint"],
            distrpath=distrpath
        )

    def mount_vbox_distro(self, distrpath):
        return self.__mount_vbox_distro[platform].format(
            mountpoint=self.config["vbox_distro_mountpoint"],
            distrpath=distrpath
        )

    def import_vm(self, path_to_image, vmname):
        return self.__import_vm.format(
            vboxmanage=self.config['vboxmanage'],
            path=path_to_image,
            vmname=vmname
        )

    def delete_vm(self):
        return self.__delete_vm.format(
            vboxmanage=self.config['vboxmanage'],
            vmname=self.config["vmname"]
        )

    def ls_on_guest(self):
        return self.__ls_on_guest.format(
            vboxmanage=self.config['vboxmanage'],
            username=self.config['vm_username'],
            password=self.config["vm_password"],
            vmname=self.config["vmname"]
        )

    def hostonly_config(self):
        return self.__hostonly_config.format(
            vboxmanage=self.config['vboxmanage'],
            adapter=self.config['hostonly_adapter']
        )

    def hostonly_create(self):
        return self.__hostonly_create.format(
            vboxmanage=self.config['vboxmanage']
        )

    def hostonly_setup(self):
        return self.__hostonly_setup.format(
            vboxmanage=self.config['vboxmanage'],
            adapter=self.config['hostonly_adapter'],
            vmname=self.config["vmname"]
        )

    def hostonly_swithc_to_dhcp(self):
        return self.__hostonly_switch_to_dhcp.format(
            vboxmanage=self.config['vboxmanage'],
            adapter=self.config['hostonly_adapter']
        )

    def hostonly_enable_dhcp(self):
        return self.__hostonly_enable_dhcp.format(
            vboxmanage=self.config['vboxmanage'],
            adapter=self.config['hostonly_adapter']
        )

    def sharedfolder_setup(self, data_folder_path):
        return self.__sharedfolder_setup.format(
            vboxmanage=self.config['vboxmanage'],
            hostpath=data_folder_path,
            vmname=self.config["vmname"],
            shared_folder_name=self.config["shared_folder_name"]
        )

    def sharedfolder_remove(self):
        return self.__sharedfolder_remove.format(
            vboxmanage=self.config['vboxmanage'],
            vmname=self.config["vmname"],
            shared_folder_name=self.config["shared_folder_name"]
        )

    def insert_guest_additions(self):
        return self.__insert_guest_additions.format(
            vboxmanage=self.config['vboxmanage'],
            vmname=self.config['vmname'],
            medium=self.config['guest_additions_path'],
        )

    def make_executable(self, filepath):
        return self.__make_executable.format(
            filepath=filepath
        )
