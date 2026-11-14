from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.security.tokens import AccessClaims, RefreshToken, TokenCodec
from app.domain.auth import ClientKind, CsrfError, SessionRevokedError
from app.domain.users import AccountBannedError, UserNotFoundError
from app.service import auth
from app.service.auth import AuthService, resolve_current_user
from tests.conftest import build_settings


def service_with(user=None, session=None):
    uow = SimpleNamespace(
        people=SimpleNamespace(
            get=AsyncMock(return_value=user), get_by_email=AsyncMock(return_value=user)
        ),
        sessions=SimpleNamespace(get_for_update=AsyncMock(return_value=session)),
    )
    return AuthService(
        uow, TokenCodec.from_settings(build_settings()), refresh_ttl=timedelta(days=1)
    )


async def test_banned_login_is_denied_even_with_a_valid_password(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth, "verify_password", AsyncMock(return_value=True))
    service = service_with(SimpleNamespace(password_hash="hash", banned_at=datetime.now(UTC)))
    with pytest.raises(AccountBannedError):
        await service.login(
            email="test@buddy.test", password="test", client=ClientKind.MOBILE, user_agent=None
        )


async def test_password_hash_is_upgraded_after_successful_login(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(password_hash="old", banned_at=None)
    monkeypatch.setattr(auth, "verify_password", AsyncMock(return_value=True))
    monkeypatch.setattr(auth, "needs_rehash", lambda _hash: True)
    monkeypatch.setattr(auth, "hash_password", AsyncMock(return_value="new"))
    service = service_with(user)
    opened = AsyncMock(return_value="tokens")
    monkeypatch.setattr(service, "_open_session", opened)
    assert (
        await service.login(
            email="test@buddy.test", password="test", client=ClientKind.MOBILE, user_agent=None
        )
        == "tokens"
    )
    assert user.password_hash == "new"
    opened.assert_awaited_once_with(user, ClientKind.MOBILE, None)


@pytest.mark.parametrize("state", ["missing", "expired", "revoked", "csrf", "banned", "deleted"])
async def test_refresh_rejects_invalid_session_or_employee(state: str) -> None:
    token = RefreshToken.new(uuid4())
    session = SimpleNamespace(
        revoked_at=None,
        expires_at=datetime.now(UTC) + timedelta(days=1),
        client=ClientKind.MOBILE,
        token_hash=token.hash,
        user_id=uuid4(),
    )
    user = SimpleNamespace(banned_at=None)
    if state == "expired":
        session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    elif state == "revoked":
        session.revoked_at = datetime.now(UTC)
    elif state == "csrf":
        session.client = ClientKind.WEB
    elif state == "banned":
        user.banned_at = datetime.now(UTC)
    service = service_with(
        None if state == "deleted" else user, None if state == "missing" else session
    )
    with pytest.raises(CsrfError if state == "csrf" else SessionRevokedError):
        await service.refresh(str(token), csrf_token=None)
    if state in {"banned", "deleted"}:
        assert session.revoked_at is not None


async def test_logout_all_and_access_resolution_fail_for_deleted_or_banned_user() -> None:
    with pytest.raises(UserNotFoundError):
        await service_with().logout_everywhere(uuid4())
    uow = SimpleNamespace(
        people=SimpleNamespace(
            get=AsyncMock(
                return_value=SimpleNamespace(
                    auth_version=1,
                    banned_at=datetime.now(UTC),
                )
            )
        )
    )
    with pytest.raises(AccountBannedError):
        await resolve_current_user(uow, AccessClaims(uuid4(), uuid4(), 1))
