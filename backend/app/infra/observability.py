"""Runtime-only credentials for the local, optional Grafana profile."""

import secrets
from pathlib import Path

from sqlalchemy import text

from app.db.database import Database


def ensure_secret(path: Path) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        # Exclusive creation keeps concurrent starts from replacing an existing key.
        try:
            with path.open("x", encoding="utf-8") as output:
                output.write(secrets.token_hex(32))
            path.chmod(0o644)  # volume is mounted only by the credential owner and Grafana
        except FileExistsError:
            pass
    return path.read_text(encoding="utf-8").strip()


async def provision_grafana(db: Database, directory: Path) -> None:
    password = ensure_secret(directory / "db_password")
    ensure_secret(directory / "admin_password")
    async with db.unit_of_work() as uow:
        # PostgreSQL does not allow a bind parameter in ALTER ROLE. quote_literal via
        # format('%L') keeps the runtime secret out of source code and SQL interpolation.
        statement = await uow.session.scalar(
            text(
                "SELECT format('ALTER ROLE orbi_grafana LOGIN PASSWORD %L', "
                "CAST(:password AS text))"
            ),
            {"password": password},
        )
        await uow.session.execute(text(str(statement)))
