import sys, os
import asyncio
from subprocess import Popen, PIPE, run
from multiprocessing import Process
import logging

if sys.platform == "win32":
    from win32com.shell.shell import ShellExecuteEx
    from win32com.shell import shellcon
    import win32con, win32event, win32process


log = logging.getLogger(__name__)


class ShellExecutor:

    def __init__(self):
        raise IllegalStateException("ShellExecutor cannot be initialized")

    @staticmethod
    def __execute(cmd, stdout_cb, stderr_cb):
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            asyncio.get_child_watcher().attach_loop(loop)
        rc = loop.run_until_complete(
            ShellExecutor._stream_subprocess(
                cmd,
                stdout_cb,
                stderr_cb,
            ))
        print("Complete executing command. Returning from __execute")
        return rc

    @staticmethod
    async def _stream_subprocess(cmd, stdout_cb, stderr_cb):
        log.debug("Launching command %s in subprocess" % cmd)
        process = await asyncio.create_subprocess_shell(cmd,
                                                        stderr=asyncio.subprocess.PIPE,
                                                        stdout=asyncio.subprocess.PIPE)
        await asyncio.wait([
            ShellExecutor._read_stream(process.stdout, stdout_cb),
            ShellExecutor._read_stream(process.stderr, stderr_cb)
        ])
        log.debug("Waiting for process.")
        return await process.wait()

    @staticmethod
    async def _read_stream(stream, cb):
        while True:
            line = await stream.readline()
            if line:
                cb(line.decode('utf8'))
            else:
                break



    @staticmethod
    def exec(cmd, on_data, on_error, on_done):
        def runner():
            res = ShellExecutor.__execute(cmd, on_data, on_error)
            on_done(res)
        p = Process(target=runner, group=None)
        p.start()



    @staticmethod
    def exec_sync(cmd, verbose=False):
        if sys.platform == 'darwin' or sys.platform == "linux":
            return ShellExecutor.exec_sync_mac(cmd, verbose)
        elif sys.platform == 'win32':
            return ShellExecutor.exec_sync_win(cmd, verbose)


    @staticmethod
    def exec_sync_win(cmd, verbose=False):
        proc = run(cmd, shell=True, encoding='cp866', stdout=PIPE, stderr=PIPE, bufsize=1)
        if verbose:
            print("RETURN CODE: %d" % proc.returncode)
            print("STDOUT: %s" % proc.stdout)
            print("STDERR: %s" % proc.stderr)
        return proc.returncode, proc.stdout, proc.stderr

    @staticmethod
    def run_vbox_installer_windows(cmd):
        cmd_dir = ''
        showCmd = win32con.SW_SHOWNORMAL
        lpVerb = 'runas'
        cmd = cmd.split(" ")
        installer = cmd[0]
        args = " ".join(cmd[1:])
        procInfo = ShellExecuteEx(nShow=showCmd,
                                  fMask=shellcon.SEE_MASK_NOCLOSEPROCESS,
                                  lpVerb=lpVerb,
                                  lpFile=installer,
                                  lpParameters=args)

        procHandle = procInfo['hProcess']
        obj = win32event.WaitForSingleObject(procHandle, win32event.INFINITE)
        rc = win32process.GetExitCodeProcess(procHandle)
        # print "Process handle %s returned code %s" % (procHandle, rc)
        log.debug("Virtualbox setup finished")
        return rc

    @staticmethod
    def exec_sync_mac(cmd, verbose=False):
        out = ""
        err = ""
        res = None
        proc = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE, bufsize=1, universal_newlines=True)
        while proc.poll() is None:
            for line in proc.stderr:
                err += line
                if verbose:
                    print("STDERR: " + line)
            for line in proc.stdout:
                out += line
                if verbose:
                    print("STDOUT: " + line)
        res = proc.returncode
        return res, out, err

    def exec_sync_mac(cmd, verbose=False):
        out = ""
        err = ""
        res = None
        proc = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE, bufsize=1, universal_newlines=True)
        while proc.poll() is None:
            for line in proc.stderr:
                err += line
                if verbose:
                    print("STDERR: " + line)
            for line in proc.stdout:
                out += line
                if verbose:
                    print("STDOUT: " + line)
        res = proc.returncode
        return res, out, err

    def exec_sync_mac(cmd, verbose=False):
        out = ""
        err = ""
        res = None
        proc = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE, bufsize=1, universal_newlines=True)
        while proc.poll() is None:
            for line in proc.stderr:
                err += line
                if verbose:
                    print("STDERR: " + line)
            for line in proc.stdout:
                out += line
                if verbose:
                    print("STDOUT: " + line)
        res = proc.returncode
        return res, out, err

    @staticmethod
    def exec_sync_mac(cmd, verbose=False):
        out = ""
        err = ""
        res = None
        proc = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE, bufsize=1, universal_newlines=True)
        while proc.poll() is None:
            for line in proc.stderr:
                err += line
                if verbose:
                    print("STDERR: " + line)
            for line in proc.stdout:
                out += line
                if verbose:
                    print("STDOUT: " + line)
        res = proc.returncode
        return res, out, err


    @staticmethod
    def exec_stream(cmd, on_data, on_error, verbose=False):
        res = None
        proc = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE, errors='ignore', bufsize=1, universal_newlines=True)
        while proc.poll() is None:
            for line in proc.stdout:
                on_data(line)
                if verbose:
                    print("STDOUT: " + line)
            for line in proc.stderr:
                on_error(line)
                if verbose:
                    print("STDERR: " + line)
        res = proc.returncode
        return res, proc.stdout, proc.stderr

    @staticmethod
    def exec_stream_as_root(cmd, on_data, on_error, passwd="", verbose=True):
        log.debug("Attempting to execute as root: %s" % cmd)
        if os.getuid() == 0:
            return ShellExecutor.exec_stream(cmd=cmd, on_data=on_data, on_error=on_error, verbose=verbose)

        res = None
        sudocmd = "sudo -S /bin/bash %s " % cmd
        proc = Popen(sudocmd, shell=True, stdout=PIPE, stdin=PIPE, stderr=PIPE, errors='ignore', bufsize=1, universal_newlines=True)
        # proc.stdin.write("{}\n".format(p^asswd))
        stdout, stderr = proc.communicate("{}\n".format(passwd))
        log.debug("Process exited!")

        res = proc.returncode
        log.debug("RETURN CODE: %d" % res)
        log.debug("stdout: %s" % stdout)
        log.debug("stderr: %s" % stderr)

        return res, stdout, stderr




class IllegalStateException(Exception):
    pass
