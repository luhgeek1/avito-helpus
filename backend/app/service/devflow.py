"""From a task to a merged pull request: tracker issues, repository guide and review requests."""

from collections.abc import Sequence
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import date

from app.core.errors import DomainError
from app.db.models import User
from app.db.uow import UnitOfWork
from app.domain.devflow import (
    Issue,
    IssueNotFoundError,
    IssueStatus,
    PullRequest,
    PullRequestNotFoundError,
    PullStatus,
    Repository,
    ReviewerSuggestion,
    ReviewNotPossibleError,
    review_warnings,
    suggest_reviewers,
)
from app.domain.events import AuditAction, NotificationKind
from app.domain.plan import ActionKind, ItemStatus, Transition
from app.domain.requests import OPEN_STATUSES, RequestKind, RequestSource, RequestView
from app.domain.users import CurrentUser, UserNotFoundError
from app.service.mappers import to_request
from app.service.notify import notify
from app.service.plan import PlanService
from app.service.ports import CorpServices
from app.service.requests import RequestService

CODE_SERVICE = "Stash"
REVIEWABLE = frozenset({PullStatus.OPEN, PullStatus.CHANGES_REQUESTED})


@dataclass(frozen=True, slots=True)
class DevOverview:
    issues: list[Issue]
    pulls: list[PullRequest]

    @property
    def current(self) -> Issue | None:
        """The issue to work on now: in progress first, then the first task, then by due date."""
        open_issues = [i for i in self.issues if i.status is not IssueStatus.DONE]
        return min(
            open_issues,
            key=lambda i: (
                i.status is not IssueStatus.IN_PROGRESS,
                not i.first_task,
                i.due or date.max,
            ),
            default=None,
        )


@dataclass(frozen=True, slots=True)
class ReviewPreparation:
    pull: PullRequest
    repository: Repository
    suggestions: list[ReviewerSuggestion]
    warnings: list[str] = field(default_factory=list)
    existing: RequestView | None = None


class DevFlowService:
    def __init__(self, uow: UnitOfWork, corp: CorpServices, *, access_sla_hours: float) -> None:
        self._uow = uow
        self._corp = corp
        self._access_sla = access_sla_hours

    async def overview(self, actor: CurrentUser) -> DevOverview:
        user = await self._user(actor)
        issues = await self._corp.issues(employee=user.email)
        pulls = await self._corp.pull_requests(employee=user.email)
        return DevOverview(issues=issues, pulls=pulls)

    async def repository(
        self, actor: CurrentUser, slug: str | None
    ) -> tuple[Repository, Issue | None]:
        """The repository asked about, or the one of the task the user works on now."""
        overview = await self.overview(actor)
        current = overview.current
        name = (slug or "").strip().lower().removeprefix("stash-") or (
            current.repository if current else ""
        )
        if not name:
            raise IssueNotFoundError(
                "На тебе пока нет задач — уточни у наставника, с какого репозитория начать"
            )
        repository = await self._corp.repository(name)
        issue = current if current and current.repository == repository.slug else None
        return repository, issue

    async def start_issue(self, actor: CurrentUser, key: str, *, idempotency_key: str) -> Issue:
        user = await self._user(actor)
        mine = await self._corp.issues(employee=user.email)
        issue = next((i for i in mine if i.key == key.strip().upper()), None)
        if issue is None:
            raise IssueNotFoundError()
        if issue.status is not IssueStatus.TODO:
            return issue
        updated = await self._corp.transition_issue(
            employee=user.email,
            key=issue.key,
            status=IssueStatus.IN_PROGRESS,
            idempotency_key=idempotency_key,
        )
        self._uow.ops.audit(
            AuditAction.ACTION_APPROVED,
            actor_id=actor.id,
            target_type="issue",
            target_id=issue.key,
            details={"status": updated.status.value, "service": "tracker"},
        )
        step = await self._uow.plan.find_by_action(actor.id, kind=ActionKind.CODE_REVIEW)
        if step is not None and step.status is ItemStatus.TODO:
            # The step may have moved on in the meantime: then there is nothing to start.
            with suppress(DomainError):
                await PlanService(self._uow).transition(actor, step.id, Transition.START)
        return updated

    async def prepare_review(
        self, actor: CurrentUser, pull_request: str | None = None
    ) -> ReviewPreparation:
        user = await self._user(actor)
        pulls = await self._corp.pull_requests(employee=user.email)
        wanted = (pull_request or "").strip().upper()
        candidates = [p for p in pulls if not wanted or wanted in (p.id, p.issue)]
        pull = next((p for p in candidates if p.status in REVIEWABLE), None)
        if pull is None:
            if candidates:
                raise ReviewNotPossibleError()
            raise PullRequestNotFoundError()
        repository = await self._corp.repository(pull.repository)
        existing = next(
            (
                r
                for r in await self._open_reviews(actor)
                if r.payload.get("pull_request") == pull.id
            ),
            None,
        )
        return ReviewPreparation(
            pull=pull,
            repository=repository,
            suggestions=suggest_reviewers(pull, repository, author=user.email),
            warnings=review_warnings(pull, repository),
            existing=existing,
        )

    async def create_review(
        self,
        actor: CurrentUser,
        *,
        pull_request: str,
        reviewers: Sequence[str],
        message: str,
        idempotency_key: str,
        source: RequestSource,
    ) -> RequestView:
        """Re-checks the pull request and the reviewers at execution time, then sends it."""
        prep = await self.prepare_review(actor, pull_request)
        allowed = {s.member.email: s.member for s in prep.suggestions}
        for rule in prep.repository.codeowners:
            for member in rule.owners:
                allowed.setdefault(member.email, member)
        chosen = [allowed[email] for email in dict.fromkeys(reviewers) if email in allowed]
        if not chosen:
            chosen = [s.member for s in prep.suggestions]
        step = await self._uow.plan.find_by_action(actor.id, kind=ActionKind.CODE_REVIEW)
        # A step already waiting for the mentor's sign-off keeps that review, not this one.
        if step is not None and step.status not in {ItemStatus.TODO, ItemStatus.IN_PROGRESS}:
            step = None
        view = await RequestService(
            self._uow, self._corp, access_sla_hours=self._access_sla
        ).create_tracked(
            actor,
            kind=RequestKind.REVIEW,
            title=f"Ревью {prep.pull.id}: {prep.pull.title}",
            payload={
                "pull_request": prep.pull.id,
                "repository": prep.repository.slug,
                "reviewers": [{"email": m.email, "name": m.name} for m in chosen],
                "message": message,
                "url": prep.pull.url,
            },
            approver=", ".join(m.name for m in chosen),
            plan_item_id=step.id if step is not None else None,
            idempotency_key=idempotency_key,
            source=source,
        )
        author = await self._user(actor)
        for member in chosen:
            reviewer = await self._uow.people.get_by_email(member.email)
            if reviewer is None:
                continue
            await notify(
                self._uow,
                user_id=reviewer.id,
                kind=NotificationKind.REVIEW_REQUESTED,
                title=f"{author.full_name} просит ревью {prep.pull.id}",
                body=f"«{prep.pull.title}». {message}".strip(),
                link=prep.pull.url,
                payload={"pull_request": prep.pull.id, "request_id": str(view.id)},
                dedupe_key=f"review:{view.id}:{reviewer.id}",
            )
        return view

    async def _open_reviews(self, actor: CurrentUser) -> list[RequestView]:
        rows = await self._uow.requests.for_user(actor.id, kind=RequestKind.REVIEW)
        return [to_request(r) for r in rows if r.status in OPEN_STATUSES]

    async def _user(self, actor: CurrentUser) -> User:
        user = await self._uow.people.get(actor.id)
        if user is None:
            raise UserNotFoundError()
        return user
