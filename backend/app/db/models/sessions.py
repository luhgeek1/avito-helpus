from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UuidPkMixin, pg_enum, utcnow
from app.domain.auth import ClientKind


class AuthSession(UuidPkMixin, Base):
    """One signed-in device. Holds the hash of its current refresh token."""

    __tablename__ = "auth_sessions"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64))
    client: Mapped[ClientKind] = mapped_column(pg_enum(ClientKind, "client_kind"))
    user_agent: Mapped[str | None] = mapped_column(String(512))

    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    last_used_at: Mapped[datetime] = mapped_column(default=utcnow)
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]
