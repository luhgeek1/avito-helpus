import re
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from uuid import UUID

from app.core.errors import ErrorCode, NotFoundError
from app.domain.users import Role


class DocScope(StrEnum):
    COMPANY = "company"
    TEAM = "team"


class DocKind(StrEnum):
    POLICY = "policy"
    GUIDE = "guide"
    TOOL = "tool"
    FAQ = "faq"
    GLOSSARY = "glossary"


class ConflictStatus(StrEnum):
    OPEN = "open"
    REPORTED = "reported"
    RESOLVED = "resolved"


SYNTHETIC_LABEL = "Тестовая инструкция, не регламент Авито"
STALE_AFTER_DAYS = 180
RRF_K = 60


@dataclass(frozen=True, slots=True)
class Section:
    heading: str
    content: str
    topic: str | None


@dataclass(frozen=True, slots=True)
class SearchHit:
    chunk_id: UUID
    document_id: UUID
    document_slug: str
    document_title: str
    heading: str
    content: str
    scope: DocScope
    team_name: str | None
    source_label: str
    source_url: str | None
    updated_at: date
    topic: str | None
    score: float

    def is_stale(self, today: date) -> bool:
        return (today - self.updated_at).days > STALE_AFTER_DAYS


@dataclass(frozen=True, slots=True)
class ConflictView:
    id: UUID
    topic: str
    summary: str
    status: ConflictStatus
    company: SearchHit
    team: SearchHit


@dataclass(frozen=True, slots=True)
class SearchResult:
    query: str
    hits: list[SearchHit]
    conflicts: list[ConflictView]
    mode: str


class DocumentNotFoundError(NotFoundError):
    error_code = ErrorCode.DOCUMENT_NOT_FOUND
    default_detail = "Document not found"


class ConflictNotFoundError(NotFoundError):
    error_code = ErrorCode.CONFLICT_NOT_FOUND
    default_detail = "Conflict not found"


def doc_visible(
    *,
    scope: DocScope,
    team_id: UUID | None,
    roles: Sequence[str],
    viewer_role: Role,
    viewer_team_id: UUID | None,
) -> bool:
    """The same rule the search SQL applies; used for single-document reads."""
    if viewer_role is Role.ADMIN:
        return True
    if roles and viewer_role.value not in roles:
        return False
    return scope is DocScope.COMPANY or team_id == viewer_team_id


_HEADING = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
_TOPIC = re.compile(r"<!--\s*topic:\s*([\w.\-]+)\s*-->")


def split_sections(body: str, *, title: str) -> list[Section]:
    """Chunk Markdown by `##` headings; `<!-- topic: x -->` tags a section for conflict checks."""
    matches = list(_HEADING.finditer(body))
    sections: list[Section] = []
    intro = body[: matches[0].start()] if matches else body
    if intro.strip():
        sections.append(_section(title, intro))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        sections.append(_section(match.group(1), body[match.end() : end]))
    return [section for section in sections if section.content]


def _section(heading: str, raw: str) -> Section:
    topic_match = _TOPIC.search(raw)
    content = _TOPIC.sub("", raw).strip()
    return Section(
        heading=heading.strip(),
        content=content,
        topic=topic_match.group(1) if topic_match else None,
    )


def reciprocal_rank_fusion(
    rankings: Iterable[Sequence[UUID]], *, k: int = RRF_K
) -> Mapping[UUID, float]:
    """Merge ranked lists (full-text, vector) without calibrating their scores to each other."""
    scores: dict[UUID, float] = {}
    for ranking in rankings:
        for rank, item_id in enumerate(ranking, start=1):
            scores[item_id] = scores.get(item_id, 0.0) + 1.0 / (k + rank)
    return scores


_SENSITIVE: Mapping[str, tuple[str, ...]] = {
    "compensation": ("зарплат", "оклад", "премии коллег", "сколько получает", "зп "),
    "personal_data": ("паспорт", "адрес коллег", "телефон коллег", "личные данные"),
    "health": ("болезн", "диагноз", "здоровь", "беременн"),
    "conflict": (
        "конфликт с наставник",
        "конфликт с руковод",
        "харасс",
        "домогатель",
        "травл",
        "оскорб",
    ),
    "dismissal": ("уволят", "увольнен", "уволиться", "уволить"),
}

SENSITIVE_TITLES: Mapping[str, str] = {
    "compensation": "вознаграждение",
    "personal_data": "персональные данные",
    "health": "здоровье",
    "conflict": "конфликт",
    "dismissal": "увольнение",
}


def detect_sensitive(text: str) -> str | None:
    """Topics Orbi must not discuss on the merits: route them to HRBP instead."""
    lowered = f"{text.lower()} "
    for topic, needles in _SENSITIVE.items():
        if any(needle in lowered for needle in needles):
            return topic
    return None


_TERM = re.compile(r"[0-9a-zа-яё]+")
_STOP = frozenset(
    {
        "как", "что", "где", "кто", "когда", "куда", "зачем", "почему", "какой", "какая", "какие",
        "мне", "меня", "мой", "моя", "мои", "это", "для", "или", "нужно", "надо", "можно", "есть",
        "ли", "на", "в", "и", "по", "с", "к", "о", "у", "а", "не", "the", "how", "what",
    }
)  # fmt: skip
_STEM = 5
_MIN_TERM = 3


def query_terms(text: str) -> set[str]:
    return {
        token[:_STEM]
        for token in _TERM.findall(text.lower())
        if len(token) >= _MIN_TERM and token not in _STOP
    }


def coverage(query: str, text: str) -> float:
    """Share of the query's meaningful word stems found in the text (0..1)."""
    terms = query_terms(query)
    if not terms:
        return 0.0
    found = {token[:_STEM] for token in _TERM.findall(text.lower())}
    return len(terms & found) / len(terms)
