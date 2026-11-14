import os
from collections.abc import Callable
from functools import cache
from pathlib import Path
from typing import Any

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from pydantic import SecretStr

from app.core.config import Settings

INTEGRATION_DIR = Path(__file__).parent / "integration"

# Defaults match docker-compose.test.yml; override with env vars to point tests elsewhere.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://postgres:secret@localhost:5439/buddy_test"
)
TEST_REDIS_URL = os.environ.get("TEST_REDIS_URL", "redis://localhost:6380/0")


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    """Everything under tests/integration is marked automatically: `pytest -m "not integration"`."""
    for item in items:
        if INTEGRATION_DIR in Path(item.fspath).parents:
            item.add_marker(pytest.mark.integration)


@cache
def rsa_key_pair() -> tuple[str, str]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    public_pem = (
        key.public_key()
        .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        .decode()
    )
    return private_pem, public_pem


def build_settings(**overrides: Any) -> Settings:
    """Settings for tests: never reads backend/.env, keys are generated once per run."""
    private_pem, public_pem = rsa_key_pair()
    values: dict[str, Any] = {
        "app_stage": "test",
        "debug": True,
        "log_level": "WARNING",
        "database_url": TEST_DATABASE_URL,
        "redis_url": TEST_REDIS_URL,
        "jwt_private_key": SecretStr(private_pem),
        "jwt_public_key": public_pem,
        "csrf_hmac_key": SecretStr("test-csrf-key"),
        "rate_limit_enabled": False,
        "llm_mode": "offline",
        "llm_api_key": None,
        "corp_mcp_url": "memory://corp",
        "corp_webhook_secret": SecretStr("test-webhook-secret"),
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)  # type: ignore[call-arg]


@pytest.fixture
def make_settings() -> Callable[..., Settings]:
    return build_settings


@pytest.fixture
def settings() -> Settings:
    return build_settings()
