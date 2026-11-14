from typing import Literal

from pydantic import BaseModel, Field

from app.api.schemas.base import RequestModel


class LoginRequest(RequestModel):
    """Credentials used for login."""

    # Plain string: demo accounts use the reserved .test domain, which strict validators reject.
    email: str = Field(..., min_length=3, max_length=320, description="Corporate e-mail")
    password: str = Field(..., max_length=128, description="User password")


class TokenPair(BaseModel):
    """
    `refresh_token` is null for web clients: they get it as an httpOnly cookie
    together with a readable `csrf_token` cookie to echo in `X-CSRF-Token`.
    """

    access_token: str
    refresh_token: str | None = None
    token_type: Literal["bearer"] = "bearer"  # noqa: S105 - OAuth2 token type, not a secret
    expires_in: int = Field(..., description="Access token lifetime in seconds")
