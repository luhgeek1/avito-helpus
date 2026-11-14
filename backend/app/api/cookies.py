from typing import Any

from fastapi import Response

from app.core.config import Settings
from app.domain.auth import IssuedTokens

REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"
# The refresh token is only ever needed by /auth endpoints, so the browser sends it nowhere else.
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _common(settings: Settings) -> dict[str, Any]:
    return {
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "domain": settings.cookie_domain or None,
    }


def set_auth_cookies(response: Response, tokens: IssuedTokens, settings: Settings) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        tokens.refresh_token,
        max_age=settings.refresh_ttl,
        httponly=True,
        path=REFRESH_COOKIE_PATH,
        **_common(settings),
    )
    # Readable by JS on purpose: the SPA echoes it in X-CSRF-Token (double-submit cookie).
    response.set_cookie(
        CSRF_COOKIE,
        tokens.csrf_token,
        max_age=settings.refresh_ttl,
        httponly=False,
        path="/",
        **_common(settings),
    )


def clear_auth_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, httponly=True, **_common(settings)
    )
    response.delete_cookie(CSRF_COOKIE, path="/", **_common(settings))


def clearing_headers(settings: Settings) -> list[tuple[str, str]]:
    """Set-Cookie headers that drop both cookies, for attaching to an error response."""
    response = Response()
    clear_auth_cookies(response, settings)
    return [("set-cookie", value) for key, value in response.headers.items() if key == "set-cookie"]
