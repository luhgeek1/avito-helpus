from dataclasses import dataclass
from enum import StrEnum

from app.core.errors import ErrorCode, ForbiddenError, UnauthorizedError


class ClientKind(StrEnum):
    """
    `web` keeps the refresh token in an httpOnly cookie guarded by CSRF;
    `mobile` receives it in the response body.
    """

    WEB = "web"
    MOBILE = "mobile"


@dataclass(frozen=True, slots=True)
class IssuedTokens:
    access_token: str
    refresh_token: str
    csrf_token: str
    expires_in: int


class WrongCredentialsError(UnauthorizedError):
    error_code = ErrorCode.WRONG_CREDENTIALS
    default_detail = "Wrong email or password"


class SessionRevokedError(UnauthorizedError):
    error_code = ErrorCode.SESSION_REVOKED
    default_detail = "Session is no longer valid, sign in again"


class RefreshTokenReusedError(SessionRevokedError):
    """An already rotated refresh token came back: it was probably stolen, so the session dies."""

    error_code = ErrorCode.REFRESH_TOKEN_REUSED
    keep_changes = True


class CsrfError(ForbiddenError):
    error_code = ErrorCode.CSRF_FAILED
    default_detail = "CSRF token is missing or invalid"
