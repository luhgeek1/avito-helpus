import argparse
import asyncio
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import BASE_DIR
from app.db.database import Database
from app.seed.loader import seed


class _SeedSettings(BaseSettings):
    """Seeding needs only the database; it must not require JWT keys or LLM settings."""

    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    database_url: str
    db_pool_size: int = 2
    db_max_overflow: int = 0
    sql_echo: bool = False


def generate_keys(directory: Path) -> str:
    """RS256 key pair for local runs and the jury's `docker compose up` (never overwrites)."""
    private_path = directory / "jwt_private_key.pem"
    public_path = directory / "jwt_public_key.pem"
    if private_path.exists() and public_path.exists():
        return f"keys already exist in {directory}"
    directory.mkdir(parents=True, exist_ok=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_path.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    private_path.chmod(0o600)
    public_path.write_bytes(
        key.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        )
    )
    return f"generated a key pair in {directory}"


async def run_seed(*, reset: bool) -> str:
    db = Database(_SeedSettings())
    try:
        counts = await seed(db, reset=reset)
    finally:
        await db.dispose()
    return f"seeded: {counts}" if counts else "already seeded (use --reset to start over)"


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    keys = commands.add_parser("keys", help="generate JWT keys if missing")
    keys.add_argument("--dir", type=Path, default=BASE_DIR / "secrets")
    seed_cmd = commands.add_parser("seed", help="load the demo company (idempotent)")
    seed_cmd.add_argument("--reset", action="store_true", help="wipe all data first")
    args = parser.parse_args()

    if args.command == "keys":
        print(generate_keys(args.dir))  # noqa: T201 - CLI output
    elif args.command == "seed":
        print(asyncio.run(run_seed(reset=args.reset)))  # noqa: T201 - CLI output


if __name__ == "__main__":
    main()
