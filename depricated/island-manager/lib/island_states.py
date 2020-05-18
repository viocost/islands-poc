from enum import Enum


class IslandStates(Enum):
    SETUP_REQUIRED = 0
    RUNNING = 1
    NOT_RUNNING = 2
    STARTING_UP = 3
    SHUTTING_DOWN = 4
    RESTARTING = 5
    UNKNOWN = 6
