"""Work tools of an engineer: tracker (Jira), code hosting (Stash), office booking, learning.

A mixin of `CorpState`: it reads the same seed and writes through the same lock and snapshot.
Everything is deterministic, so a demo and a test see the same tasks, reviewers and free rooms.
"""

import re
from datetime import date, datetime, time, timedelta
from typing import TYPE_CHECKING, Any
from zoneinfo import ZoneInfo

from mcp.server.mcpserver.exceptions import ToolError

if TYPE_CHECKING:
    from corp_mock.state import Ticket

LOCAL_TZ = ZoneInfo("Europe/Moscow")
WORKING_WEEK = 5
ISSUE_STATUSES = ("todo", "in_progress", "in_review", "done")
BOOKING_LIVE = frozenset({"pending_approval", "approved"})
ENROLLMENT_DAYS = 14
STOP_WORDS = frozenset({"по", "на", "про", "для", "мне", "меня", "есть", "какие", "найди", "хочу"})


class WorkspaceRefused(ToolError):
    def __init__(self, message: str) -> None:
        super().__init__(f"refused: {message}")


def _today() -> date:
    return datetime.now(LOCAL_TZ).date()


def _minutes(value: str) -> int:
    hour, minute = map(int, value.split(":"))
    return hour * 60 + minute


def _overlaps(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def _on_day(rule: Any, day: date) -> bool:
    return bool(rule == "daily" or rule == day.weekday())


class WorkspaceMixin:
    """Tracker, code hosting, office and learning state on top of the ticket store."""

    _seed: dict[str, Any]
    tickets: dict[str, "Ticket"]
    by_key: dict[str, str]
    messages: list[dict[str, Any]]

    # Provided by CorpState.
    def _new(
        self, service: str, prefix: str, employee: str, key: str, payload: dict[str, Any]
    ) -> "Ticket": ...

    def _post(self, *, channel: str, text: str, author: str, key: str) -> str: ...

    # ---- state -------------------------------------------------------------------------------

    def reset_workspace(self) -> None:
        self.issues: dict[str, dict[str, Any]] = {
            issue["key"]: {"status": issue["status"]} for issue in self._seed["issues"]
        }
        self.pulls: dict[str, dict[str, Any]] = {
            pr["id"]: {"status": pr["status"], "reviewers": []}
            for pr in self._seed["pull_requests"]
        }
        self.transition_keys: dict[str, str] = {}
        # (employee, course) -> {"due": iso date, "progress": int, "mandatory": bool}
        self.learning: dict[str, dict[str, Any]] = {}
        today = _today()
        for email, employee in self._seed["employees"].items():
            for item in employee.get("learning", []):
                self.learning[f"{email}|{item['course']}"] = {
                    "due": (today + timedelta(days=item["due_days"])).isoformat(),
                    "progress": item["progress"],
                    "mandatory": item["mandatory"],
                }

    def workspace_snapshot(self) -> dict[str, Any]:
        return {
            "issues": self.issues,
            "pulls": self.pulls,
            "transition_keys": self.transition_keys,
            "learning": self.learning,
        }

    def restore_workspace(self, data: dict[str, Any]) -> None:
        """Older snapshots have no workspace state: start it from the seed."""
        self.reset_workspace()
        self.issues.update(data.get("issues", {}))
        self.pulls.update(data.get("pulls", {}))
        self.transition_keys.update(data.get("transition_keys", {}))
        self.learning.update(data.get("learning", {}))

    def _name(self, email: str) -> str:
        return str(self._seed["directory"].get(email, email))

    # ---- tracker (Jira) ----------------------------------------------------------------------

    def _issue(self, key: str) -> dict[str, Any]:
        seed = next((i for i in self._seed["issues"] if i["key"] == key.upper()), None)
        if seed is None:
            raise WorkspaceRefused(f"unknown issue {key}")
        pull = next(
            (p["id"] for p in self._seed["pull_requests"] if p["issue"] == seed["key"]), None
        )
        due = _today() + timedelta(days=seed["due_days"])
        return {
            "key": seed["key"],
            "title": seed["title"],
            "type": seed["type"],
            "status": self.issues[seed["key"]]["status"],
            "points": seed["points"],
            "due": due.isoformat(),
            "repository": seed["repository"],
            "branch": f"{seed['key']}-{seed['slug']}",
            "description": seed["description"],
            "url": f"https://jira.buddy.test/browse/{seed['key']}",
            "pull_request": pull,
            "first_task": bool(seed.get("first_task")),
        }

    def tracker_issues(self, employee: str) -> list[dict[str, Any]]:
        return [self._issue(i["key"]) for i in self._seed["issues"] if i["assignee"] == employee]

    def tracker_transition(self, employee: str, key: str, status: str, idem: str) -> dict[str, Any]:
        issue = self._issue(key)
        seed = next(i for i in self._seed["issues"] if i["key"] == issue["key"])
        if seed["assignee"] != employee:
            raise WorkspaceRefused("issue is assigned to another employee")
        if status not in ISSUE_STATUSES:
            raise WorkspaceRefused("unknown issue status")
        if idem in self.transition_keys:
            if self.transition_keys[idem] != f"{issue['key']}:{status}":
                raise WorkspaceRefused("idempotency key reused with a different transition")
            return issue
        if issue["status"] == "done" and status != "done":
            raise WorkspaceRefused("a done issue cannot be reopened from the assistant")
        self.issues[issue["key"]]["status"] = status
        self.transition_keys[idem] = f"{issue['key']}:{status}"
        return self._issue(issue["key"])

    # ---- code hosting (Stash) ----------------------------------------------------------------

    def code_repository(self, slug: str) -> dict[str, Any]:
        repo = self._seed["repositories"].get(slug)
        if repo is None:
            raise WorkspaceRefused(f"unknown repository {slug}")
        return {
            "slug": slug,
            **{k: v for k, v in repo.items() if k != "codeowners"},
            "required_approvers": [
                {"email": e, "name": self._name(e)} for e in repo["required_approvers"]
            ],
            "codeowners": [
                {
                    "path": rule["path"],
                    "owners": [{"email": e, "name": self._name(e)} for e in rule["owners"]],
                }
                for rule in repo["codeowners"]
            ],
        }

    def _pull(self, pr: dict[str, Any]) -> dict[str, Any]:
        live = self.pulls[pr["id"]]
        return {
            "id": pr["id"],
            "repository": pr["repository"],
            "title": pr["title"],
            "branch": pr["branch"],
            "target": pr["target"],
            "issue": pr["issue"],
            "status": live["status"],
            "checks": pr["checks"],
            "changed": pr["changed"],
            "reviewers": [{"email": e, "name": self._name(e)} for e in live["reviewers"]],
            "url": f"https://stash.buddy.test/projects/{pr['repository']}/pull-requests/{pr['id']}",
        }

    def code_pull_requests(self, employee: str) -> list[dict[str, Any]]:
        return [self._pull(pr) for pr in self._seed["pull_requests"] if pr["author"] == employee]

    def code_request_review(
        self, *, employee: str, pull_request: str, reviewers: list[str], message: str, key: str
    ) -> "Ticket":
        pr = next((p for p in self._seed["pull_requests"] if p["id"] == pull_request.upper()), None)
        if pr is None or pr["author"] != employee:
            raise WorkspaceRefused(f"unknown pull request {pull_request}")
        payload = {"pull_request": pr["id"], "reviewers": sorted(reviewers), "message": message}
        if key in self.by_key:
            return self._new("review", "REV", employee, key, payload)
        if self.pulls[pr["id"]]["status"] not in {"open", "changes_requested"}:
            raise WorkspaceRefused("pull request is not open for review")
        unknown = [e for e in reviewers if e not in self._seed["directory"]]
        if not reviewers or unknown or employee in reviewers:
            raise WorkspaceRefused("reviewers must be known teammates other than the author")
        ticket = self._new("review", "REV", employee, key, payload)
        ticket.approver = ", ".join(self._name(e) for e in sorted(reviewers))
        ticket.sla_hours = 4
        ticket.decision = (pr["review"]["status"], pr["review"]["comment"])
        self.pulls[pr["id"]]["reviewers"] = sorted(reviewers)
        self.issues[pr["issue"]]["status"] = "in_review"
        for email in sorted(reviewers):
            self._post(
                channel="@" + email.split("@")[0],
                text=f"{self._name(employee)} просит ревью {pr['id']} «{pr['title']}». {message}".strip(),
                author="stash-bot",
                key=f"{key}:{email}",
            )
        return ticket

    # ---- office booking ----------------------------------------------------------------------

    def _office_resource(self, resource: str) -> tuple[str, dict[str, Any]]:
        office = self._seed["office"]
        for kind, items in (("room", office["rooms"]), ("desk", office["desks"])):
            for item in items:
                if item["id"] == resource:
                    return kind, item
        raise WorkspaceRefused(f"unknown office resource {resource}")

    def _busy(self, resource: str, day: date) -> list[tuple[int, int]]:
        busy = [
            (_minutes(rule["time"]), _minutes(rule["time"]) + rule["minutes"])
            for rule in self._seed["office"]["busy"]
            if rule["resource"] == resource and _on_day(rule["weekday"], day)
        ]
        for ticket in self.tickets.values():
            payload = ticket.payload
            if (
                ticket.service == "booking"
                and ticket.status in BOOKING_LIVE
                and payload["resource"] == resource
                and payload["date"] == day.isoformat()
            ):
                busy.append((_minutes(payload["start"]), _minutes(payload["end"])))
        return busy

    def _check_day(self, day: date) -> None:
        if day < _today() or day.weekday() >= WORKING_WEEK or (day - _today()).days > 30:
            raise WorkspaceRefused("office can be booked on working days within 30 days")

    def booking_rooms(self, day: date, start: str, end: str, capacity: int) -> list[dict[str, Any]]:
        self._check_day(day)
        span = (_minutes(start), _minutes(end))
        return [
            room
            for room in self._seed["office"]["rooms"]
            if room["capacity"] >= capacity
            and not any(_overlaps(span, b) for b in self._busy(room["id"], day))
        ]

    def booking_desks(self, day: date) -> list[dict[str, Any]]:
        self._check_day(day)
        return [desk for desk in self._seed["office"]["desks"] if not self._busy(desk["id"], day)]

    def booking_create(
        self,
        *,
        employee: str,
        resource: str,
        day: date,
        start: str,
        end: str,
        title: str,
        attendees: list[str],
        key: str,
    ) -> "Ticket":
        kind, item = self._office_resource(resource)
        office = self._seed["office"]
        if kind == "desk":
            start, end, attendees = office["hours"][0], office["hours"][1], []
        span = (_minutes(start), _minutes(end))
        payload = {
            "kind": kind,
            "resource": resource,
            "name": item["name"],
            "date": day.isoformat(),
            "start": start,
            "end": end,
            "title": title,
            "attendees": sorted(attendees),
        }
        existing = self.by_key.get(key)
        if existing is None:
            self._check_day(day)
            opens, closes = (_minutes(t) for t in office["hours"])
            if not (opens <= span[0] < span[1] <= closes):
                raise WorkspaceRefused("booking must fit office hours")
            if kind == "room" and span[1] - span[0] > office["max_room_minutes"]:
                raise WorkspaceRefused("rooms are booked for at most 2 hours")
            if kind == "room" and item["capacity"] < 1 + len(attendees):
                raise WorkspaceRefused("room is too small")
            if any(a not in self._seed["directory"] for a in attendees):
                raise WorkspaceRefused("unknown attendee")
            if any(_overlaps(span, b) for b in self._busy(resource, day)):
                raise WorkspaceRefused("slot is already taken")
        ticket = self._new("booking", "BKG", employee, key, payload)
        if existing is not None:
            return ticket
        when = f"{day:%d.%m} {start}–{end}" if kind == "room" else f"{day:%d.%m}, весь день"
        if attendees:
            names = ", ".join(self._name(a) for a in sorted(attendees))
            ticket.approver = names
            ticket.sla_hours = 4
            ticket.decision = ("approved", f"{names}: приглашение принято, {item['name']}, {when}")
        else:
            ticket.approver = "Сервис бронирования"
            ticket.status = "approved"
            ticket.comment = f"Забронировано: {item['name']}, {when}"
        return ticket

    def booked_events(self, employee: str, start: date, end: date) -> list[dict[str, Any]]:
        events = []
        for ticket in self.tickets.values():
            payload = ticket.payload
            if (
                ticket.service != "booking"
                or ticket.status not in BOOKING_LIVE
                or payload["kind"] != "room"
                or (ticket.employee != employee and employee not in payload["attendees"])
            ):
                continue
            day = date.fromisoformat(payload["date"])
            if not start <= day <= end:
                continue
            at = datetime.combine(day, time.fromisoformat(payload["start"]), tzinfo=LOCAL_TZ)
            events.append(
                {
                    "title": f"{payload['title']} · {payload['name']}",
                    "starts_at": at.isoformat(),
                    "important": True,
                    "minutes": _minutes(payload["end"]) - _minutes(payload["start"]),
                }
            )
        return events

    # ---- learning platform and development plan --------------------------------------------

    def _course(self, course_id: str) -> dict[str, Any]:
        course = next((c for c in self._seed["courses"] if c["id"] == course_id), None)
        if course is None:
            raise WorkspaceRefused(f"unknown course {course_id}")
        return course

    def learning_courses(self, employee: str) -> list[dict[str, Any]]:
        today = _today()
        items = []
        for key, record in self.learning.items():
            email, course_id = key.split("|", 1)
            if email != employee:
                continue
            course = self._course(course_id)
            due = date.fromisoformat(record["due"])
            progress = record["progress"]
            status = (
                "completed"
                if progress >= 100
                else "overdue"
                if due < today
                else "in_progress"
                if progress
                else "assigned"
            )
            items.append(
                {
                    "id": course_id,
                    "title": course["title"],
                    "provider": course["provider"],
                    "hours": course["hours"],
                    "mandatory": record["mandatory"],
                    "due": record["due"],
                    "progress": progress,
                    "status": status,
                    "url": f"https://learn.buddy.test/courses/{course_id}",
                }
            )
        for ticket in self.tickets.values():
            if (
                ticket.service == "learning"
                and ticket.employee == employee
                and ticket.status == "pending_approval"
            ):
                course = self._course(ticket.payload["course"])
                items.append(
                    {
                        "id": course["id"],
                        "title": course["title"],
                        "provider": course["provider"],
                        "hours": course["hours"],
                        "mandatory": False,
                        "due": None,
                        "progress": 0,
                        "status": "pending_approval",
                        "url": f"https://learn.buddy.test/courses/{course['id']}",
                    }
                )
        return sorted(items, key=lambda c: (c["status"] == "completed", c["due"] or "9999"))

    def learning_catalog(self, employee: str, query: str) -> list[dict[str, Any]]:
        words = [
            w
            for w in re.findall(r"[a-zа-яё0-9]+", query.lower())
            if len(w) > 1 and w not in STOP_WORDS and not w.startswith(("курс", "обучен"))
        ]
        taken = {c["id"] for c in self.learning_courses(employee)}
        found = []
        for course in self._seed["courses"]:
            haystack = " ".join([course["title"].lower(), *course["topics"]])
            if words and not any(
                w[:6] in haystack or any(t in w for t in course["topics"]) for w in words
            ):
                continue
            found.append(
                {
                    "id": course["id"],
                    "title": course["title"],
                    "provider": course["provider"],
                    "hours": course["hours"],
                    "external": course["external"],
                    "enrolled": course["id"] in taken,
                }
            )
        return found

    def learning_enroll(self, *, employee: str, course: str, key: str) -> "Ticket":
        item = self._course(course)
        if key in self.by_key:
            return self._new("learning", "EDU", employee, key, {"course": course})
        if any(c["id"] == course for c in self.learning_courses(employee)):
            raise WorkspaceRefused("already enrolled in this course")
        ticket = self._new("learning", "EDU", employee, key, {"course": course})
        due = _today() + timedelta(days=ENROLLMENT_DAYS)
        if item["external"]:
            ticket.approver = "Руководитель (бюджет обучения)"
            ticket.decision = (
                "approved",
                f"Руководитель согласовал оплату курса «{item['title']}» из бюджета обучения",
            )
            return ticket
        ticket.approver = "Учебная платформа"
        ticket.status = "approved"
        ticket.comment = (
            f"Записал на курс «{item['title']}»: доступ открыт, рекомендованный срок — {due:%d.%m}"
        )
        self.learning[f"{employee}|{course}"] = {
            "due": due.isoformat(),
            "progress": 0,
            "mandatory": False,
        }
        return ticket

    def set_progress(self, employee: str, course: str, progress: int) -> None:
        record = self.learning.get(f"{employee}|{course}")
        if record is None:
            raise WorkspaceRefused("employee is not enrolled in this course")
        record["progress"] = max(0, min(100, progress))

    def development_plan(self, employee: str) -> list[dict[str, Any]]:
        today = _today()
        return [
            {
                "goal": goal["goal"],
                "competency": goal["competency"],
                "level": goal["level"],
                "due": (today + timedelta(days=goal["due_days"])).isoformat(),
                "progress": goal["progress"],
                "status": goal["status"],
            }
            for goal in self._seed["employees"].get(employee, {}).get("development", [])
        ]

    # ---- decisions ---------------------------------------------------------------------------

    def workspace_decided(self, ticket: "Ticket") -> None:
        """Consequences of a decision inside the tools themselves."""
        if ticket.service == "review":
            pr = next(
                p for p in self._seed["pull_requests"] if p["id"] == ticket.payload["pull_request"]
            )
            approved = ticket.status == "approved"
            if ticket.status in {"approved", "rejected"}:
                self.pulls[pr["id"]]["status"] = "approved" if approved else "changes_requested"
                self.issues[pr["issue"]]["status"] = "in_review" if approved else "in_progress"
            else:
                self.pulls[pr["id"]]["reviewers"] = []
        if ticket.service == "learning" and ticket.status == "approved":
            due = _today() + timedelta(days=ENROLLMENT_DAYS)
            self.learning.setdefault(
                f"{ticket.employee}|{ticket.payload['course']}",
                {"due": due.isoformat(), "progress": 0, "mandatory": False},
            )


__all__ = ["WorkspaceMixin", "WorkspaceRefused"]
