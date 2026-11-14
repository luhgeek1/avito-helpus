from datetime import date, datetime
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UuidPkMixin, pg_enum
from app.domain.users import Role


class Team(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "teams"

    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    channel: Mapped[str] = mapped_column(String(100), default="", server_default="")


class User(UuidPkMixin, TimestampMixin, Base):
    """
    An employee. Accounts come from the (imitated) corporate SSO via the seed, so there is no
    self-registration; mentor/lead/hrbp links are what ABAC rules read.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    full_name: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(200), default="", server_default="")
    role: Mapped[Role] = mapped_column(
        pg_enum(Role, "user_role"), default=Role.INTERN, server_default=Role.INTERN.value
    )
    track: Mapped[str] = mapped_column(String(32), default="backend", server_default="backend")
    start_date: Mapped[date | None]

    team_id: Mapped[UUID | None] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"))
    mentor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    lead_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    hrbp_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    banned_at: Mapped[datetime | None]
    # Bumped on ban and "log out everywhere": access tokens carry it and die on mismatch.
    auth_version: Mapped[int] = mapped_column(default=1, server_default="1")

    __table_args__ = (
        Index("ix_users_team_id", "team_id"),
        Index("ix_users_mentor_id", "mentor_id"),
        Index("ix_users_lead_id", "lead_id"),
        Index("ix_users_hrbp_id", "hrbp_id"),
    )
