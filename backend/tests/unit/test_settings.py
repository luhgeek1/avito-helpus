from collections.abc import Callable

import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings


def test_production_refuses_development_secrets(make_settings: Callable[..., Settings]) -> None:
    with pytest.raises(ValidationError, match="Unsafe production settings"):
        make_settings(app_stage="prod", debug=False)


def test_production_accepts_real_secrets(make_settings: Callable[..., Settings]) -> None:
    settings = make_settings(
        app_stage="prod",
        debug=False,
        cookie_secure=True,
        csrf_hmac_key=SecretStr("a-long-random-value"),
        corp_webhook_secret=SecretStr("another-random-value"),
    )

    assert not settings.show_api_docs


def test_jwt_keys_are_required(make_settings: Callable[..., Settings]) -> None:
    with pytest.raises(ValidationError, match="JWT keys are required"):
        make_settings(jwt_private_key=None, jwt_public_key=None)


def test_cors_origins_are_split(make_settings: Callable[..., Settings]) -> None:
    settings = make_settings(cors_allow_origins="http://a.test, http://b.test,")

    assert settings.cors_origins == ["http://a.test", "http://b.test"]


def test_llm_is_online_only_with_a_key(make_settings: Callable[..., Settings]) -> None:
    assert not make_settings(llm_mode="auto", llm_api_key=None).llm_online
    assert make_settings(llm_mode="auto", llm_api_key=SecretStr("sk-test")).llm_online
    assert not make_settings(llm_mode="offline", llm_api_key=SecretStr("sk-test")).llm_online
    assert make_settings(llm_mode="online", llm_base_url="http://ollama:11434/v1").llm_online


def test_empty_base_url_means_default(make_settings: Callable[..., Settings]) -> None:
    assert make_settings(llm_base_url="").llm_base_url is None
