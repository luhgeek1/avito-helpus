from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from app.core.security.passwords import hash_password, needs_rehash, verify_password
from app.core.security.tokens import AccessClaims, RefreshToken, TokenCodec
from app.db.models import AuthSession, User
from app.db.uow import UnitOfWork
from app.domain.auth import (
    ClientKind,
    CsrfError,
    IssuedTokens,
    RefreshTokenReusedError,
    SessionRevokedError,
    WrongCredentialsError,
)
from app.domain.users import (
    AccountBannedError,
    CurrentUser,
    UserNotFoundError,
    normalize_email,
)

_USER_AGENT_MAX = 512


class AuthService:
    def __init__(self, uow: UnitOfWork, codec: TokenCodec, *, refresh_ttl: timedelta) -> None:
        self._uow = uow
        self._codec = codec
        self._refresh_ttl = refresh_ttl

    async def login(
        self,
        *,
        email: str,
        password: str,
        client: ClientKind,
        user_agent: str | None,
    ) -> IssuedTokens:
        user = await self._uow.people.get_by_email(normalize_email(email))
        valid = await verify_password(password, user.password_hash if user else None)
        if user is None or not valid:
            raise WrongCredentialsError()
        if user.banned_at is not None:
            raise AccountBannedError()

        if needs_rehash(user.password_hash):
            user.password_hash = await hash_password(password)
        return await self._open_session(user, client, user_agent)

    async def refresh(self, raw_token: str, *, csrf_token: str | None) -> IssuedTokens:
        token = RefreshToken.parse(raw_token)
        session = await self._uow.sessions.get_for_update(token.session_id)
        now = datetime.now(UTC)
        if session is None or session.revoked_at is not None or session.expires_at <= now:
            raise SessionRevokedError()
        if session.client is ClientKind.WEB and not self._codec.csrf_matches(raw_token, csrf_token):
            raise CsrfError()
        if not token.matches(session.token_hash):
            session.revoked_at = now
            raise RefreshTokenReusedError()

        user = await self._uow.people.get(session.user_id)
        if user is None or user.banned_at is not None:
            session.revoked_at = now
            raise SessionRevokedError()

        rotated = RefreshToken.new(session.id)
        session.token_hash = rotated.hash
        session.last_used_at = now
        session.expires_at = now + self._refresh_ttl
        return self._issue(user, rotated, now)

    async def logout(self, raw_token: str) -> None:
        """Idempotent: an unknown or already revoked token is not an error."""
        token = RefreshToken.parse(raw_token)
        session = await self._uow.sessions.get_for_update(token.session_id)
        if session is not None and session.revoked_at is None and token.matches(session.token_hash):
            session.revoked_at = datetime.now(UTC)

    async def logout_everywhere(self, user_id: UUID) -> None:
        user = await self._uow.people.get(user_id, for_update=True)
        if user is None:
            raise UserNotFoundError()
        user.auth_version += 1
        await self._uow.sessions.revoke_all(user.id, now=datetime.now(UTC))

    async def _open_session(
        self, user: User, client: ClientKind, user_agent: str | None
    ) -> IssuedTokens:
        now = datetime.now(UTC)
        token = RefreshToken.new(uuid4())
        self._uow.sessions.add(
            AuthSession(
                id=token.session_id,
                user_id=user.id,
                token_hash=token.hash,
                client=client,
                user_agent=user_agent[:_USER_AGENT_MAX] if user_agent else None,
                created_at=now,
                last_used_at=now,
                expires_at=now + self._refresh_ttl,
            )
        )
        await self._uow.flush()
        return self._issue(user, token, now)

    def _issue(self, user: User, token: RefreshToken, now: datetime) -> IssuedTokens:
        raw_refresh = str(token)
        return IssuedTokens(
            access_token=self._codec.issue_access(
                user_id=user.id,
                session_id=token.session_id,
                auth_version=user.auth_version,
                now=now,
            ),
            refresh_token=raw_refresh,
            csrf_token=self._codec.csrf_for(raw_refresh),
            expires_in=int(self._codec.access_ttl.total_seconds()),
        )


async def resolve_current_user(uow: UnitOfWork, claims: AccessClaims) -> CurrentUser:
    """One primary-key lookup per request: catches bans, role changes and logout-everywhere."""
    user = await uow.people.get(claims.user_id)
    if user is None or user.auth_version != claims.auth_version:
        raise SessionRevokedError()
    if user.banned_at is not None:
        raise AccountBannedError()
    return CurrentUser(
        id=user.id, role=user.role, session_id=claims.session_id, team_id=user.team_id
    )
