"""An engineer's daily loop: task in the tracker → branch → pull request → review.

Rules only: who should review a pull request and what stops a review request. Data comes from
the tracker and code hosting through the `CorpServices` port.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from app.core.errors import ConflictError, ErrorCode, NotFoundError

MAX_REVIEWERS = 3


class IssueStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"


ISSUE_STATUS_TITLES: Mapping[IssueStatus, str] = {
    IssueStatus.TODO: "к выполнению",
    IssueStatus.IN_PROGRESS: "в работе",
    IssueStatus.IN_REVIEW: "на ревью",
    IssueStatus.DONE: "готово",
}


class PullStatus(StrEnum):
    OPEN = "open"
    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"
    MERGED = "merged"


PULL_STATUS_TITLES: Mapping[PullStatus, str] = {
    PullStatus.OPEN: "открыт",
    PullStatus.APPROVED: "одобрен",
    PullStatus.CHANGES_REQUESTED: "нужны правки",
    PullStatus.MERGED: "смержен",
}


@dataclass(frozen=True, slots=True)
class TeamMember:
    email: str
    name: str


@dataclass(frozen=True, slots=True)
class Issue:
    key: str
    title: str
    type: str
    status: IssueStatus
    points: int
    due: date | None
    repository: str
    branch: str
    description: str
    url: str
    pull_request: str | None = None
    first_task: bool = False

    @property
    def status_title(self) -> str:
        return ISSUE_STATUS_TITLES[self.status]


@dataclass(frozen=True, slots=True)
class CodeOwnerRule:
    path: str
    owners: tuple[TeamMember, ...]

    def matches(self, changed: str) -> bool:
        return self.path == "*" or changed.startswith(self.path)


@dataclass(frozen=True, slots=True)
class Repository:
    slug: str
    project: str
    clone_url: str
    web_url: str
    default_branch: str
    dev_url: str
    run: str
    checks: str
    review_group: str
    team_channel: str
    required_approvers: tuple[TeamMember, ...]
    codeowners: tuple[CodeOwnerRule, ...]


@dataclass(frozen=True, slots=True)
class PullRequest:
    id: str
    repository: str
    title: str
    branch: str
    target: str
    issue: str
    status: PullStatus
    checks: str
    changed: tuple[str, ...]
    reviewers: tuple[TeamMember, ...]
    url: str

    @property
    def status_title(self) -> str:
        return PULL_STATUS_TITLES[self.status]

    @property
    def checks_passed(self) -> bool:
        return self.checks == "passed"


@dataclass(frozen=True, slots=True)
class ReviewerSuggestion:
    member: TeamMember
    reason: str


def suggest_reviewers(
    pull: PullRequest, repository: Repository, *, author: str
) -> list[ReviewerSuggestion]:
    """Required approvers first (the team lead), then the owners of the changed code.

    The most specific CODEOWNERS rule wins for each changed file; the author never reviews
    their own pull request.
    """
    chosen: dict[str, ReviewerSuggestion] = {}
    for member in repository.required_approvers:
        if member.email != author:
            chosen.setdefault(member.email, ReviewerSuggestion(member, "обязательный аппрув"))
    for changed in pull.changed:
        rules = [r for r in repository.codeowners if r.matches(changed)]
        if not rules:
            continue
        rule = max(rules, key=lambda r: 0 if r.path == "*" else len(r.path))
        reason = "владелец всего репозитория" if rule.path == "*" else f"владелец {rule.path}"
        for member in rule.owners:
            if member.email != author:
                chosen.setdefault(member.email, ReviewerSuggestion(member, reason))
    return list(chosen.values())[:MAX_REVIEWERS]


def review_warnings(pull: PullRequest, repository: Repository) -> list[str]:
    warnings = []
    if not pull.checks_passed:
        warnings.append(
            f"Проверки PR не прошли. Ревьюеры увидят красную сборку: лучше сначала запусти "
            f"`{repository.checks}` и запушь исправления."
        )
    if pull.target != repository.default_branch:
        warnings.append(
            f"PR открыт в {pull.target}, а в этом репозитории принято открывать в "
            f"{repository.default_branch}."
        )
    return warnings


class PullRequestNotFoundError(NotFoundError):
    error_code = ErrorCode.NOT_FOUND
    default_detail = (
        "Не нашёл у тебя открытый pull request. Сначала запушь ветку и открой PR в Stash"
    )


class ReviewNotPossibleError(ConflictError):
    error_code = ErrorCode.CONFLICT
    default_detail = "Этот pull request уже одобрен или закрыт — ревью запрашивать не нужно"


class IssueNotFoundError(NotFoundError):
    error_code = ErrorCode.NOT_FOUND
    default_detail = "Такой задачи на тебе нет. Проверь ключ, например LST-1432"
