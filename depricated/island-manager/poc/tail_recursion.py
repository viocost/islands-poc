class TailRecusive(Exception):
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs


def recurse(*args, **kwargs):
    raise TailRecusive(*args, **kwargs)


def tail_recursive(fun):
    def decorated(*args, **kwargs):
        while True:
            try:
                return fun(*args, **kwargs)
            except TailRecusive as r:
                args = r.args
                kwargs = r.kwargs
                continue
    return decorated


@tail_recursive
def countdown(n):
    if n <= -50:
        return
    print(n)
    recurse(n-1)


if __name__ == '__main__':
    countdown(1115000)

