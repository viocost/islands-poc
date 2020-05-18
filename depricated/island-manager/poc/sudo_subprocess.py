import subprocess as sp


def main():
    p = sp.Popen("sudo -S echo   RUNNING AS ROOT!", shell=True, stdin=sp.PIPE, stdout=sp.PIPE, stderr=sp.PIPE, errors='ignore', bufsize=1, universal_newlines=True)
    outs, errs = p.communicate("{}\n".format("RazDvaTri321"))
    while p.poll() is None:
        for i in outs.split():
            print(i)
        for i in errs.split():
            print(i)

    # outs, errs = p.communicate("echo ECHOING AS ROOT!")
    # for i in outs:
    #     print(i)
    # for i in errs:
    #     print(i)

if __name__ == '__main__':
    if __name__ == '__main__':
        main()

