from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import Settings
from app.core.errors import InvalidTokenError, TokenExpiredError
from app.core.security.tokens import RefreshToken, TokenCodec
from tests.conftest import rsa_key_pair


@pytest.fixture
def codec(settings: Settings) -> TokenCodec:
    return TokenCodec.from_settings(settings)


def test_access_token_round_trip(codec: TokenCodec) -> None:
    user_id, session_id = uuid4(), uuid4()
    token = codec.issue_access(user_id=user_id, session_id=session_id, auth_version=3)

    claims = codec.decode_access(token)

    assert (claims.user_id, claims.session_id, claims.auth_version) == (user_id, session_id, 3)


def test_expired_access_token_is_rejected(codec: TokenCodec) -> None:
    long_ago = datetime.now(UTC) - timedelta(hours=1)
    token = codec.issue_access(user_id=uuid4(), session_id=uuid4(), auth_version=1, now=long_ago)

    with pytest.raises(TokenExpiredError):
        codec.decode_access(token)


def _claims(**overrides: object) -> dict[str, object]:
    now = int(datetime.now(UTC).timestamp())
    claims: dict[str, object] = {
        "sub": str(uuid4()),
        "sid": str(uuid4()),
        "av": 1,
        "typ": "access",
        "iat": now,
        "exp": now + 60,
    }
    claims.update(overrides)
    return claims


def test_token_signed_with_another_key_is_rejected(codec: TokenCodec) -> None:
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    token = jwt.encode(_claims(), other_key, algorithm="RS256")

    with pytest.raises(InvalidTokenError):
        codec.decode_access(token)


def test_hs256_token_is_rejected(codec: TokenCodec) -> None:
    # Classic algorithm-confusion attack: we only accept the configured algorithm.
    token = jwt.encode(_claims(), "s" * 32, algorithm="HS256")
    with pytest.raises(InvalidTokenError):
        codec.decode_access(token)


def test_refresh_style_token_is_not_an_access_token(codec: TokenCodec) -> None:
    private_pem, _ = rsa_key_pair()

    token = jwt.encode(_claims(typ="refresh"), private_pem, algorithm="RS256")

    with pytest.raises(InvalidTokenError):
        codec.decode_access(token)


def test_token_without_required_claims_is_rejected(codec: TokenCodec) -> None:
    private_pem, _ = rsa_key_pair()
    claims = _claims()
    del claims["sid"]

    token = jwt.encode(claims, private_pem, algorithm="RS256")

    with pytest.raises(InvalidTokenError):
        codec.decode_access(token)


def test_csrf_is_bound_to_the_refresh_token(codec: TokenCodec) -> None:
    csrf = codec.csrf_for("refresh-a")

    assert codec.csrf_matches("refresh-a", csrf)
    assert not codec.csrf_matches("refresh-b", csrf)
    assert not codec.csrf_matches("refresh-a", None)


def test_refresh_token_round_trip() -> None:
    token = RefreshToken.new(uuid4())

    parsed = RefreshToken.parse(str(token))

    assert parsed == token
    assert parsed.matches(token.hash)
    assert not RefreshToken.new(token.session_id).matches(token.hash)


@pytest.mark.parametrize("raw", ["", "garbage", "not-a-uuid.secret", f"{uuid4()}."])
def test_malformed_refresh_token_is_rejected(raw: str) -> None:
    with pytest.raises(InvalidTokenError):
        RefreshToken.parse(raw)
