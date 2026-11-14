from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import jwt
import pytest
from pydantic import ValidationError

from app import worker
from app.core import config
from app.core.errors import InvalidTokenError
from app.core.security.tokens import TokenCodec
from app.infra.observability import ensure_secret
from tests.conftest import build_settings, rsa_key_pair


def test_settings_key_files_docs_and_unsafe_debug(tmp_path: Path) -> None:
    private, public = rsa_key_pair()
    private_path, public_path = tmp_path / "private.pem", tmp_path / "public.pem"
    private_path.write_text(private, encoding="utf-8")
    public_path.write_text(public, encoding="utf-8")
    settings = build_settings(
        jwt_private_key=None,
        jwt_public_key=None,
        jwt_private_key_path=private_path,
        jwt_public_key_path=public_path,
        api_docs_enabled=True,
    )
    assert settings.jwt_public_key == public
    assert settings.jwt_private_key.get_secret_value() == private
    assert settings.show_api_docs
    assert config._resolve(Path("relative.pem")) == config.BASE_DIR / "relative.pem"
    assert config.Settings._normalize_samesite(None) is None
    with pytest.raises(ValidationError, match="DEBUG must be false"):
        build_settings(app_stage="prod")


def test_settings_cache_constructs_once(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = build_settings()
    factory = Mock(return_value=settings)
    monkeypatch.setattr(config, "Settings", factory)
    config.get_settings.cache_clear()
    try:
        assert config.get_settings() is config.get_settings() is settings
        factory.assert_called_once_with()
    finally:
        config.get_settings.cache_clear()


@pytest.mark.parametrize("field", ["sub", "sid", "av"])
def test_signed_access_tokens_reject_malformed_claims(field: str) -> None:
    settings = build_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(uuid4()),
        "sid": str(uuid4()),
        "av": 1,
        "typ": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=1)).timestamp()),
    }
    payload[field] = "invalid"
    token = jwt.encode(payload, settings.jwt_private_key.get_secret_value(), algorithm="RS256")
    with pytest.raises(InvalidTokenError):
        TokenCodec.from_settings(settings).decode_access(token)


def test_token_codec_fails_clearly_without_keys() -> None:
    with pytest.raises(RuntimeError, match="JWT keys"):
        TokenCodec.from_settings(SimpleNamespace(jwt_private_key=None))


def test_secret_creation_race_keeps_existing_winner(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    path = tmp_path / "secret"
    path.write_text("winner", encoding="utf-8")
    original = Path.exists
    monkeypatch.setattr(Path, "exists", lambda self: False if self == path else original(self))
    assert ensure_secret(path) == "winner"


def test_worker_main_runs_with_configured_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = build_settings()
    run = Mock()
    monkeypatch.setattr(worker, "get_settings", lambda: settings)
    monkeypatch.setattr(worker, "configure_logging", Mock())
    job = Mock(return_value="awaitable")
    monkeypatch.setattr(worker, "run_worker", job)
    monkeypatch.setattr(worker.asyncio, "run", run)
    worker.main()
    job.assert_called_once_with(settings)
    run.assert_called_once_with("awaitable")


async def test_maintenance_jobs_use_heavy_model_only_when_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from contextlib import asynccontextmanager  # noqa: PLC0415

    @asynccontextmanager
    async def unit_of_work():
        yield SimpleNamespace(sessions=SimpleNamespace(delete_stale=AsyncMock(return_value=2)))

    db = SimpleNamespace(unit_of_work=unit_of_work)
    generator = object()
    monkeypatch.setattr(worker, "text_generator", lambda _settings: generator)
    monkeypatch.setattr(worker, "build_embeddings", lambda _settings: None)
    detector = AsyncMock(return_value=3)
    monkeypatch.setattr(
        worker,
        "KnowledgeService",
        Mock(
            return_value=SimpleNamespace(
                embed_pending=AsyncMock(return_value=4),
                detect_conflicts=detector,
            )
        ),
    )
    jobs = worker.maintenance_jobs(db, build_settings())
    assert [await job.run() for job in jobs] == [2, 4, 3]
    detector.assert_awaited_once_with(generator, worker.CONFLICT_TOPICS)
