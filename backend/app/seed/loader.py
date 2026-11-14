import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from zlib import crc32

import yaml
from sqlalchemy import func, select, text

from app.core.clock import LOCAL_TZ, today, utcnow
from app.core.security.passwords import hash_password
from app.db.base import Base
from app.db.database import Database
from app.db.models import (
    AccessResource,
    Escalation,
    FeatureFlagRow,
    PlanTemplateItem,
    ServiceRequest,
    Team,
    User,
)
from app.db.uow import UnitOfWork
from app.domain.escalations import Chain, EscalationKind, first_assignment
from app.domain.knowledge import SYNTHETIC_LABEL, DocKind, DocScope
from app.domain.plan import Audience, Confirmation, ItemStatus, Stage, WaitingReason
from app.domain.requests import (
    AccessLevel,
    ApproverRole,
    RequestKind,
    RequestSource,
    RequestStatus,
    Sensitivity,
)
from app.domain.users import Role
from app.service.knowledge import KnowledgeService
from app.service.plan import PlanService

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
ESCALATION_SLA = timedelta(hours=24)


@dataclass(frozen=True, slots=True)
class Document:
    meta: dict[str, Any]
    body: str


def load_yaml(name: str) -> dict[str, Any]:
    data: dict[str, Any] = yaml.safe_load((DATA_DIR / name).read_text(encoding="utf-8"))
    return data


def load_documents() -> list[Document]:
    """Markdown files with a YAML front matter block."""
    documents = []
    for path in sorted((DATA_DIR / "knowledge").glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        _, front, body = raw.split("---", 2)
        documents.append(Document(meta=yaml.safe_load(front), body=body.strip() + "\n"))
    return documents


async def _truncate(uow: UnitOfWork) -> None:
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    await uow.session.execute(text(f"TRUNCATE {tables} CASCADE"))


async def seed(db: Database, *, reset: bool = False) -> dict[str, int]:
    """Load the demo company. Idempotent: without `reset` a seeded database is left alone."""
    async with db.unit_of_work() as uow:
        if reset:
            await _truncate(uow)
        elif await uow.session.scalar(select(func.count()).select_from(User)):
            logger.info("database already seeded, skipping")
            return {}
        return await _load(uow, on=today())


async def _load(uow: UnitOfWork, *, on: date) -> dict[str, int]:
    org = load_yaml("org.yaml")
    teams = await _teams(uow, org["teams"])
    people = await _people(uow, org, teams, on=on)
    templates = await _templates(uow, load_yaml("plan.yaml")["items"])
    resources = _resources(uow, load_yaml("resources.yaml")["resources"], teams)
    for flag in org["flags"]:
        uow.ops.add_flag(FeatureFlagRow(**flag))
    documents = await _knowledge(uow, teams, on=on)
    state = load_yaml("state.yaml")
    await _plans(uow, people, state["interns"], on=on)
    await _history(uow, people, state.get("escalations", []))
    await uow.flush()
    counts = {
        "teams": len(teams),
        "people": len(people),
        "plan_templates": len(templates),
        "resources": resources,
        "documents": documents,
    }
    logger.info("demo company seeded: %s", counts)
    return counts


async def _teams(uow: UnitOfWork, rows: list[dict[str, Any]]) -> dict[str, Team]:
    teams = {row["slug"]: Team(**row) for row in rows}
    for team in teams.values():
        uow.people.add_team(team)
    await uow.flush()
    return teams


async def _people(
    uow: UnitOfWork, org: dict[str, Any], teams: dict[str, Team], *, on: date
) -> dict[str, User]:
    password_hash = await hash_password(org["password"])
    people: dict[str, User] = {}
    for row in org["people"]:
        days_ago = row.get("start_days_ago")
        user = User(
            email=row["email"],
            password_hash=password_hash,
            full_name=row["full_name"],
            title=row["title"],
            role=Role(row["role"]),
            track=row.get("track", "backend"),
            start_date=on - timedelta(days=days_ago) if days_ago is not None else None,
            team_id=teams[row["team"]].id if row.get("team") else None,
        )
        uow.people.add(user)
        people[row["key"]] = user
    await uow.flush()
    for row in org["people"]:
        user = people[row["key"]]
        for link in ("mentor", "lead", "hrbp"):
            if row.get(link):
                setattr(user, f"{link}_id", people[row[link]].id)
    await uow.flush()
    return people


async def _templates(uow: UnitOfWork, rows: list[dict[str, Any]]) -> list[PlanTemplateItem]:
    templates = []
    positions: dict[str, int] = {}
    for row in rows:
        stage = Stage(row["stage"])
        positions[stage] = positions.get(stage, 0) + 1
        template = PlanTemplateItem(
            slug=row["slug"],
            track=row.get("track", "all"),
            stage=stage,
            position=positions[stage],
            title=row["title"],
            description=row.get("description", ""),
            category=row.get("category", "org"),
            audience=Audience(row.get("audience", "intern")),
            confirmation=Confirmation(row.get("confirmation", "self")),
            action=row.get("action"),
            quiz=row.get("quiz"),
            doc_slugs=row.get("doc_slugs", []),
            needs_laptop=row.get("needs_laptop", False),
        )
        uow.plan.add_template(template)
        templates.append(template)
    await uow.flush()
    return templates


def _resources(uow: UnitOfWork, rows: list[dict[str, Any]], teams: dict[str, Team]) -> int:
    for row in rows:
        uow.requests.add_resource(
            AccessResource(
                slug=row["slug"],
                name=row["name"],
                system=row["system"],
                description=row.get("description", ""),
                team_id=teams[row["team"]].id if row.get("team") else None,
                sensitivity=Sensitivity(row.get("sensitivity", "standard")),
                approver_role=ApproverRole(row.get("approver_role", "team_lead")),
                default_level=AccessLevel(row.get("default_level", "read")),
                aliases=row.get("aliases", []),
            )
        )
    return len(rows)


async def _knowledge(uow: UnitOfWork, teams: dict[str, Team], *, on: date) -> int:
    service = KnowledgeService(uow, embeddings=None)
    documents = load_documents()
    for document in documents:
        meta = document.meta
        await service.ingest(
            slug=meta["slug"],
            title=meta["title"],
            kind=DocKind(meta["kind"]),
            scope=DocScope(meta["scope"]),
            team_id=teams[meta["team"]].id if meta.get("team") else None,
            roles=meta.get("roles", []),
            owner=meta.get("owner", ""),
            source_label=meta.get("source_label", SYNTHETIC_LABEL),
            source_url=meta.get("source_url"),
            updated_at=on - timedelta(days=meta.get("updated_days_ago", 0)),
            body=document.body,
        )
    # Conflicts are declared by knowledge-base owners on the team document.
    for document in documents:
        for conflict in document.meta.get("conflicts", []):
            await service.register_conflict(
                topic=conflict["topic"],
                summary=conflict["summary"],
                team_document=document.meta["slug"],
            )
    return len(documents)


async def _plans(
    uow: UnitOfWork, people: dict[str, User], states: dict[str, Any], *, on: date
) -> None:
    plans = PlanService(uow)
    for key, user in people.items():
        if user.role is not Role.INTERN or user.start_date is None:
            continue
        await plans.instantiate(user, start=user.start_date)
        await _apply_state(uow, user, states.get(key, {}), on=on)


async def _apply_state(uow: UnitOfWork, user: User, state: dict[str, Any], *, on: date) -> None:
    rows = {template.slug: item for item, template in await uow.plan.items(user.id)}
    start = datetime.combine(user.start_date or on, datetime.min.time(), tzinfo=LOCAL_TZ)
    for offset, slug in enumerate(state.get("done", [])):
        item = rows[slug]
        item.status = ItemStatus.DONE
        item.started_at = start + timedelta(hours=offset)
        item.completed_at = min(start + timedelta(days=1 + offset // 3), utcnow())
        item.confirmed_by_id = user.id
    for slug in state.get("in_progress", []):
        rows[slug].status = ItemStatus.IN_PROGRESS
        rows[slug].started_at = start
    for slug in state.get("review", []):
        rows[slug].status = ItemStatus.WAITING
        rows[slug].waiting_reason = WaitingReason.MENTOR_REVIEW
        rows[slug].started_at = start
    for slug, reason in state.get("blocked", {}).items():
        rows[slug].status = ItemStatus.BLOCKED
        rows[slug].blocked_reason = reason
    if "access-stash" in state.get("done", []):
        request = _approved_access(uow, user, rows["access-stash"].id, start)
        await uow.flush()
        for status, note in (
            (RequestStatus.SUBMITTING, None),
            (RequestStatus.SUBMITTED, f"Зарегистрирована: {request.external_id}"),
            (RequestStatus.APPROVED, "Доступ выдан"),
        ):
            uow.requests.add_event(request, status=status, source=RequestSource.WEBHOOK, note=note)


def _approved_access(uow: UnitOfWork, user: User, item_id: Any, start: datetime) -> ServiceRequest:
    """A request an intern already went through, so "Мои заявки" has history from day one."""
    request = ServiceRequest(
        user_id=user.id,
        kind=RequestKind.ACCESS,
        status=RequestStatus.APPROVED,
        title="Доступ: Репозиторий listings-api (редактирование)",
        external_id=f"ACC-{crc32(user.email.encode()) % 900 + 100}",
        payload={
            "resource": "stash-listings-api",
            "resource_name": "Репозиторий listings-api",
            "system": "Stash",
            "level": "write",
            "justification": "Задачи первой недели",
        },
        approver="Мария Ким, руководитель команды",
        plan_item_id=item_id,
        idempotency_key=f"seed:{user.id}:stash",
        resolved_at=start + timedelta(hours=5),
        created_at=start + timedelta(hours=1),
    )
    uow.requests.add(request)
    return request


async def _history(uow: UnitOfWork, people: dict[str, User], rows: list[dict[str, Any]]) -> None:
    await uow.flush()
    for row in rows:
        asker = people[row["from"]]
        kind = EscalationKind(row["kind"])
        assignment = first_assignment(kind, Chain(asker.mentor_id, asker.lead_id, asker.hrbp_id))
        created = utcnow() - timedelta(hours=row["hours_ago"])
        uow.escalations.add(
            Escalation(
                user_id=asker.id,
                assignee_id=assignment.assignee_id,
                level=assignment.level,
                kind=kind,
                question=row["question"],
                context=row.get("context", {}),
                due_at=created + ESCALATION_SLA,
                created_at=created,
            )
        )
