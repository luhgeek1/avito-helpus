import hashlib
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum

from app.core.errors import ErrorCode, NotFoundError

_BUCKETS = 100


class Flag(StrEnum):
    """Known flags; the table holds their state, the code holds their meaning."""

    ASSISTANT = "orbi_assistant"
    PROACTIVE_NUDGES = "proactive_nudges"
    FAQ_PUBLISHING = "faq_publishing"
    LLM_CONFLICT_CHECK = "llm_conflict_check"


@dataclass(frozen=True, slots=True)
class FlagState:
    key: str
    enabled: bool
    rollout_percent: int
    variants: Sequence[str]
    description: str


@dataclass(frozen=True, slots=True)
class FlagDecision:
    key: str
    enabled: bool
    variant: str | None


class FlagNotFoundError(NotFoundError):
    error_code = ErrorCode.FLAG_NOT_FOUND
    default_detail = "Feature flag not found"


def bucket(key: str, unit: str) -> int:
    """Stable 0..99 bucket: the same unit always lands in the same place for a given flag."""
    digest = hashlib.sha256(f"{key}:{unit}".encode()).digest()
    return int.from_bytes(digest[:4], "big") % _BUCKETS


def evaluate(flag: FlagState, unit: str) -> FlagDecision:
    """
    Units are teams, not people: an A/B on onboarding must keep a whole team in one variant,
    otherwise mentors see mixed behaviour and the experiment leaks between arms.
    """
    if not flag.enabled:
        return FlagDecision(key=flag.key, enabled=False, variant=None)
    slot = bucket(flag.key, unit)
    enabled = slot < flag.rollout_percent
    variant = None
    if flag.variants:
        variant = flag.variants[bucket(f"{flag.key}:variant", unit) % len(flag.variants)]
    return FlagDecision(key=flag.key, enabled=enabled, variant=variant)


def evaluate_all(flags: Sequence[FlagState], unit: str) -> Mapping[str, FlagDecision]:
    return {flag.key: evaluate(flag, unit) for flag in flags}
