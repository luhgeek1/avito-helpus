import hashlib
import hmac
import math

SIGNATURE_PREFIX = "sha256="


def sign(secret: str, timestamp: str, body: bytes) -> str:
    digest = hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    return SIGNATURE_PREFIX + digest


def verify(
    secret: str,
    *,
    timestamp: str | None,
    signature: str | None,
    body: bytes,
    now: float,
    tolerance_sec: int,
) -> bool:
    """HMAC over `timestamp.body` plus a freshness window, so a captured call can't be replayed."""
    if not timestamp or not signature:
        return False
    try:
        sent_at = float(timestamp)
    except ValueError:
        return False
    if not math.isfinite(sent_at) or abs(now - sent_at) > tolerance_sec:
        return False
    return hmac.compare_digest(sign(secret, timestamp, body).encode(), signature.encode())
