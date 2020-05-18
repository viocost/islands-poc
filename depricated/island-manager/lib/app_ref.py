class AppRef:
    """
    This is singleton reference class to PyQt application object
    Needed for Popup reference.
    """
    app = None

    @staticmethod
    def set_app(app):
        AppRef.app = app

    @staticmethod
    def get_app():
        if AppRef.app is None:
            raise AppNotInitialized
        return AppRef.app


class AppNotInitialized(Exception):
    pass
