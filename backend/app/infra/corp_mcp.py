import asyncio
import logging
from collections.abc import Sequence
from datetime import date, datetime
from typing import Any

from mcp import Client

from app.domain.corp import (
    AccessGrant,
    CorpEvent,
    CorpRequestError,
    CorpTicket,
    CorpTicketStatus,
    CorpUnavailableError,
    EquipmentItem,
    EquipmentStatus,
)
from app.domain.devflow import (
    CodeOwnerRule,
    Issue,
    IssueStatus,
    PullRequest,
    PullStatus,
    Repository,
    TeamMember,
)
from app.domain.learning import (
    CatalogCourse,
    Course,
    CourseStatus,
    DevelopmentGoal,
    GoalStatus,
)
from app.domain.office import Desk, Room
from app.infra.metrics import CORP_CALLS

logger = logging.getLogger(__name__)


class McpCorpServices:
    """
    `CorpServices` over MCP (streamable HTTP). One short session per call: the mock is local and
    stateless per request, and a per-call session never leaves a half-broken connection behind.
    Tool errors that mean "refused" carry `refused: true`; anything else is treated as transient.
    """

    def __init__(self, target: Any, *, timeout_sec: float) -> None:
        # A URL in production; tests pass the corp-mock server object to connect in memory.
        self._target = target
        self._timeout = timeout_sec

    async def _call(self, tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
        try:
            async with asyncio.timeout(self._timeout), Client(self._target) as client:
                result = await client.call_tool(tool, arguments)
        except TimeoutError as exc:
            CORP_CALLS.labels(tool=tool, outcome="timeout").inc()
            raise CorpUnavailableError(f"{tool}: timed out") from exc
        except Exception as exc:  # transport failures of any kind are retryable for us
            CORP_CALLS.labels(tool=tool, outcome="unavailable").inc()
            logger.warning("corp call %s failed: %r", tool, exc)
            raise CorpUnavailableError(f"{tool}: service unavailable") from exc

        data = _structured(result.structured_content)
        if result.is_error:
            text = " ".join(getattr(block, "text", "") for block in result.content).strip()
            CORP_CALLS.labels(tool=tool, outcome="error").inc()
            if "refused:" in text:
                raise CorpRequestError(text.split("refused:", 1)[1].strip() or None)
            raise CorpUnavailableError(text or f"{tool}: failed")
        CORP_CALLS.labels(tool=tool, outcome="ok").inc()
        return data

    async def access_check(self, *, employee: str, resource: str) -> AccessGrant:
        data = await self._call("access_check", {"employee": employee, "resource": resource})
        granted = data.get("granted_at")
        return AccessGrant(
            has_access=bool(data.get("has_access")),
            level=data.get("level"),
            granted_at=date.fromisoformat(granted) if granted else None,
        )

    async def access_create(
        self,
        *,
        employee: str,
        resource: str,
        level: str,
        justification: str,
        approver: str,
        idempotency_key: str,
    ) -> CorpTicket:
        data = await self._call(
            "access_create_request",
            {
                "employee": employee,
                "resource": resource,
                "level": level,
                "justification": justification,
                "approver": approver,
                "idempotency_key": idempotency_key,
            },
        )
        return _ticket(data)

    async def access_get(self, external_id: str) -> CorpTicket:
        return _ticket(await self._call("access_get_request", {"request_id": external_id}))

    async def access_remind(self, external_id: str, *, idempotency_key: str | None = None) -> None:
        await self._call(
            "access_remind", {"request_id": external_id, "idempotency_key": idempotency_key}
        )

    async def cancel_request(self, external_id: str) -> CorpTicket:
        return _ticket(await self._call("request_cancel", {"request_id": external_id}))

    async def absence_balance(self, *, employee: str) -> int:
        data = await self._call("absence_balance", {"employee": employee})
        return int(data.get("days_left", 0))

    async def absence_create(
        self,
        *,
        employee: str,
        type_: str,
        start: date,
        end: date,
        comment: str,
        idempotency_key: str,
    ) -> CorpTicket:
        data = await self._call(
            "absence_create_request",
            {
                "employee": employee,
                "type": type_,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "comment": comment,
                "idempotency_key": idempotency_key,
            },
        )
        return _ticket(data)

    async def absence_get(self, external_id: str) -> CorpTicket:
        return _ticket(await self._call("absence_get_request", {"request_id": external_id}))

    async def calendar_events(self, *, employee: str, start: date, end: date) -> list[CorpEvent]:
        data = await self._call(
            "calendar_events",
            {"employee": employee, "date_from": start.isoformat(), "date_to": end.isoformat()},
        )
        return [
            CorpEvent(
                title=event["title"],
                starts_at=datetime.fromisoformat(event["starts_at"]),
                important=bool(event.get("important")),
                minutes=int(event.get("minutes", 30)),
            )
            for event in data.get("events", [])
        ]

    async def equipment(self, *, employee: str) -> list[EquipmentItem]:
        data = await self._call("itsupport_equipment", {"employee": employee})
        return [
            EquipmentItem(
                kind=item["kind"],
                model=item["model"],
                status=EquipmentStatus(item["status"]),
                eta=date.fromisoformat(item["eta"]) if item.get("eta") else None,
                pickup_location=item.get("pickup_location"),
                pickup_hours=item.get("pickup_hours"),
                note=item.get("note"),
            )
            for item in data.get("items", [])
        ]

    async def it_ticket_create(
        self, *, employee: str, category: str, description: str, idempotency_key: str
    ) -> CorpTicket:
        data = await self._call(
            "itsupport_create_ticket",
            {
                "employee": employee,
                "category": category,
                "description": description,
                "idempotency_key": idempotency_key,
            },
        )
        return _ticket(data)

    async def it_ticket_get(self, external_id: str) -> CorpTicket:
        return _ticket(await self._call("itsupport_get_ticket", {"ticket_id": external_id}))

    async def post_message(
        self, *, channel: str, text: str, author: str, idempotency_key: str
    ) -> str:
        data = await self._call(
            "messenger_post",
            {
                "channel": channel,
                "text": text,
                "author": author,
                "idempotency_key": idempotency_key,
            },
        )
        return str(data.get("message_id", ""))

    async def request_get(self, external_id: str) -> CorpTicket:
        return _ticket(await self._call("request_get", {"request_id": external_id}))

    # ---- tracker and code hosting ----------------------------------------------------------

    async def issues(self, *, employee: str) -> list[Issue]:
        data = await self._call("tracker_issues", {"employee": employee})
        return [_issue(item) for item in data.get("issues", [])]

    async def transition_issue(
        self, *, employee: str, key: str, status: IssueStatus, idempotency_key: str
    ) -> Issue:
        data = await self._call(
            "tracker_transition",
            {
                "employee": employee,
                "issue_key": key,
                "status": status.value,
                "idempotency_key": idempotency_key,
            },
        )
        return _issue(data)

    async def repository(self, slug: str) -> Repository:
        data = await self._call("code_repository", {"repository": slug})
        return Repository(
            slug=data["slug"],
            project=data["project"],
            clone_url=data["clone_url"],
            web_url=data["web_url"],
            default_branch=data["default_branch"],
            dev_url=data["dev_url"],
            run=data["run"],
            checks=data["checks"],
            review_group=data["review_group"],
            team_channel=data["team_channel"],
            required_approvers=tuple(_member(m) for m in data.get("required_approvers", [])),
            codeowners=tuple(
                CodeOwnerRule(rule["path"], tuple(_member(m) for m in rule["owners"]))
                for rule in data.get("codeowners", [])
            ),
        )

    async def pull_requests(self, *, employee: str) -> list[PullRequest]:
        data = await self._call("code_pull_requests", {"employee": employee})
        return [
            PullRequest(
                id=pr["id"],
                repository=pr["repository"],
                title=pr["title"],
                branch=pr["branch"],
                target=pr["target"],
                issue=pr["issue"],
                status=PullStatus(pr["status"]),
                checks=pr["checks"],
                changed=tuple(pr.get("changed", [])),
                reviewers=tuple(_member(m) for m in pr.get("reviewers", [])),
                url=pr["url"],
            )
            for pr in data.get("pull_requests", [])
        ]

    async def review_create(
        self,
        *,
        employee: str,
        pull_request: str,
        reviewers: Sequence[str],
        message: str,
        idempotency_key: str,
    ) -> CorpTicket:
        data = await self._call(
            "code_request_review",
            {
                "employee": employee,
                "pull_request": pull_request,
                "reviewers": list(reviewers),
                "message": message,
                "idempotency_key": idempotency_key,
            },
        )
        return _ticket(data)

    # ---- office booking ----------------------------------------------------------------------

    async def free_rooms(self, *, day: date, start: str, end: str, capacity: int) -> list[Room]:
        data = await self._call(
            "booking_rooms",
            {"day": day.isoformat(), "start_time": start, "end_time": end, "capacity": capacity},
        )
        return [
            Room(
                id=r["id"],
                name=r["name"],
                floor=int(r["floor"]),
                capacity=int(r["capacity"]),
                equipment=r.get("equipment", ""),
            )
            for r in data.get("rooms", [])
        ]

    async def free_desks(self, *, day: date) -> list[Desk]:
        data = await self._call("booking_desks", {"day": day.isoformat()})
        return [
            Desk(id=d["id"], name=d["name"], floor=int(d["floor"]), zone=d.get("zone", ""))
            for d in data.get("desks", [])
        ]

    async def booking_create(
        self,
        *,
        employee: str,
        resource: str,
        day: date,
        start: str,
        end: str,
        title: str,
        attendees: Sequence[str],
        idempotency_key: str,
    ) -> CorpTicket:
        data = await self._call(
            "booking_create",
            {
                "employee": employee,
                "resource": resource,
                "day": day.isoformat(),
                "start_time": start,
                "end_time": end,
                "title": title,
                "attendees": list(attendees),
                "idempotency_key": idempotency_key,
            },
        )
        return _ticket(data)

    # ---- learning platform and IDP -----------------------------------------------------------

    async def courses(self, *, employee: str) -> list[Course]:
        data = await self._call("learning_courses", {"employee": employee})
        return [
            Course(
                id=c["id"],
                title=c["title"],
                provider=c["provider"],
                hours=int(c["hours"]),
                mandatory=bool(c.get("mandatory")),
                due=_date(c.get("due")),
                progress=int(c.get("progress", 0)),
                status=CourseStatus(c["status"]),
                url=c["url"],
            )
            for c in data.get("courses", [])
        ]

    async def course_catalog(self, *, employee: str, query: str) -> list[CatalogCourse]:
        data = await self._call("learning_catalog", {"employee": employee, "query": query})
        return [
            CatalogCourse(
                id=c["id"],
                title=c["title"],
                provider=c["provider"],
                hours=int(c["hours"]),
                external=bool(c.get("external")),
                enrolled=bool(c.get("enrolled")),
            )
            for c in data.get("courses", [])
        ]

    async def course_enroll(
        self, *, employee: str, course: str, idempotency_key: str
    ) -> CorpTicket:
        data = await self._call(
            "learning_enroll",
            {"employee": employee, "course": course, "idempotency_key": idempotency_key},
        )
        return _ticket(data)

    async def development_plan(self, *, employee: str) -> list[DevelopmentGoal]:
        data = await self._call("development_plan", {"employee": employee})
        return [
            DevelopmentGoal(
                goal=g["goal"],
                competency=g["competency"],
                level=g["level"],
                due=_date(g.get("due")),
                progress=int(g.get("progress", 0)),
                status=GoalStatus(g["status"]),
            )
            for g in data.get("goals", [])
        ]

    async def reset_demo(self) -> None:
        await self._call("demo_reset", {})


def _structured(content: Any) -> dict[str, Any]:
    if not isinstance(content, dict):
        return {}
    # Tools returning a plain value are wrapped as {"result": ...} by the server SDK.
    inner = content.get("result")
    if len(content) == 1 and isinstance(inner, dict):
        return inner
    return content


def _date(value: Any) -> date | None:
    return date.fromisoformat(value) if value else None


def _member(data: dict[str, Any]) -> TeamMember:
    return TeamMember(email=data["email"], name=data["name"])


def _issue(data: dict[str, Any]) -> Issue:
    return Issue(
        key=data["key"],
        title=data["title"],
        type=data["type"],
        status=IssueStatus(data["status"]),
        points=int(data.get("points", 0)),
        due=_date(data.get("due")),
        repository=data["repository"],
        branch=data["branch"],
        description=data.get("description", ""),
        url=data["url"],
        pull_request=data.get("pull_request"),
        first_task=bool(data.get("first_task")),
    )


def _ticket(data: dict[str, Any]) -> CorpTicket:
    return CorpTicket(
        external_id=str(data["request_id"]),
        status=CorpTicketStatus(data["status"]),
        comment=data.get("comment"),
        sla_hours=data.get("sla_hours"),
        approver=data.get("approver"),
        idempotency_key=data.get("idempotency_key"),
    )
