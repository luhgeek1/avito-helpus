from enum import Enum


class Unset(Enum):
    """Marks a PATCH field the client did not send, as opposed to one it set to null."""

    TOKEN = 0


UNSET = Unset.TOKEN
