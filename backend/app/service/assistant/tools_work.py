"""Agent tools for the engineer's work loop, office booking and learning.

Thin wrappers over `DevFlowService`, `OfficeService` and `LearningService`: read tools answer
from the corporate services, action tools show a card first and re-check everything when the
user confirms.
"""

from datetime import date, timedelta
from typing import Any, Literal

from app.core.errors import DomainError
from app.domain.assistant import ActionCard, CardField
from app.domain.corp import CorpUnavailableError
from app.domain.devflow import IssueStatus, PullStatus
from app.domain.learning import CourseStatus
from app.domain.office import BOOKING_TITLES, WORKING_WEEK, BookingKind, end_time
from app.domain.requests import RequestSource
from app.service.assistant.actions import Ctx, _card, _request_message, _submit_now, request_part
from app.service.devflow import CODE_SERVICE, DevFlowService
from app.service.learning import LearningService
from app.service.office import BOOKING_SERVICE, MENTOR_MEETING, OfficeService

UNAVAILABLE = "Сервис сейчас не отвечает. Попробуй через пару минут."


def _sla(ctx: Ctx) -> float:
    return ctx.deps.settings.access_sla_hours


def _next_working_day(day: date) -> date:
    day += timedelta(days=1)
    while day.weekday() >= WORKING_WEEK:
        day += timedelta(days=1)
    return day


def _issue_part(issue: Any) -> dict[str, Any]:
    return {
        "key": issue.key,
        "title": issue.title,
        "status": issue.status.value,
        "status_title": issue.status_title,
        "due": issue.due.isoformat() if issue.due else None,
        "branch": issue.branch,
        "url": issue.url,
        "pull_request": issue.pull_request,
        "first_task": issue.first_task,
    }


def _pull_part(pull: Any) -> dict[str, Any]:
    return {
        "id": pull.id,
        "title": pull.title,
        "status": pull.status.value,
        "status_title": pull.status_title,
        "checks": pull.checks,
        "url": pull.url,
        "reviewers": [m.name for m in pull.reviewers],
    }


# ---- work loop: tracker and code hosting -------------------------------------------------------


async def my_tasks(ctx: Ctx) -> dict[str, Any]:
    """The user's tasks in Jira and pull requests in Stash: statuses, due dates, what to do next."""
    async with ctx.deps.db.unit_of_work() as uow:
        try:
            service = DevFlowService(uow, ctx.deps.corp, access_sla_hours=_sla(ctx))
            overview = await service.overview(ctx.deps.actor)
        except CorpUnavailableError:
            return {"message": "Jira сейчас не отвечает. " + UNAVAILABLE, "error": "unavailable"}
    issues = [_issue_part(i) for i in overview.issues]
    pulls = [_pull_part(p) for p in overview.pulls]
    if not issues and not pulls:
        return {
            "message": "Задач на тебе пока нет. Первую задачу обычно выдаёт наставник — "
            "могу спросить его.",
            "issues": [],
        }
    ctx.deps.emit("tasks", {"issues": issues, "pull_requests": pulls})
    lines = [
        f"• {i['key']} «{i['title']}» — {i['status_title']}"
        + (f", срок {date.fromisoformat(i['due']):%d.%m}" if i["due"] else "")
        for i in issues
        if i["status"] != IssueStatus.DONE.value
    ]
    for pull in overview.pulls:
        line = f"• {pull.id} «{pull.title}» — {pull.status_title}"
        if not pull.checks_passed:
            line += ", проверки не прошли"
        lines.append(line)
    current = overview.current
    hint = ""
    if current is not None and current.status is IssueStatus.TODO:
        hint = f"\nНачни с {current.key}: могу перевести её в работу и подсказать имя ветки."
    elif any(p.status in {PullStatus.OPEN, PullStatus.CHANGES_REQUESTED} for p in overview.pulls):
        hint = "\nPR открыт — могу подобрать ревьюеров и отправить на ревью."
    return {
        "message": "Твои задачи:\n" + "\n".join(lines) + hint,
        "issues": issues,
        "pull_requests": pulls,
    }


async def repository_guide(ctx: Ctx, repository: str | None = None) -> dict[str, Any]:
    """How to clone, branch, run, check and open a PR for a repository (default: current task's).

    Args:
        repository: Repository name such as "listings-api"; leave empty for the current task.
    """
    async with ctx.deps.db.unit_of_work() as uow:
        try:
            repo, issue = await DevFlowService(
                uow, ctx.deps.corp, access_sla_hours=_sla(ctx)
            ).repository(ctx.deps.actor, repository)
        except CorpUnavailableError:
            return {"message": "Stash сейчас не отвечает. " + UNAVAILABLE, "error": "unavailable"}
        except DomainError as exc:
            return {"message": exc.detail, "error": exc.error_code.value}
    branch = issue.branch if issue else f"{repo.project}-<номер>-<описание>"
    owners = ", ".join(m.name for m in repo.required_approvers)
    message = (
        f"Репозиторий {repo.slug} ({CODE_SERVICE}):\n"
        f"1. Склонировать: `git clone {repo.clone_url}`\n"
        f"2. Ветка от {repo.default_branch}: `git checkout -b {branch}`\n"
        f"3. Запуск локально: `{repo.run}`, перед PR — `{repo.checks}`\n"
        f"4. PR — в {repo.default_branch}, ревьюеры через {repo.review_group}"
        + (f", обязательный аппрув: {owners}" if owners else "")
        + "\n"
        f"5. После мержа фича появится на dev: {repo.dev_url}"
    )
    if issue is not None:
        message += f"\nТекущая задача: {issue.key} «{issue.title}»."
    return {
        "message": message,
        "repository": repo.slug,
        "clone_url": repo.clone_url,
        "branch": branch,
        "dev_url": repo.dev_url,
    }


async def start_task(ctx: Ctx, issue_key: str) -> dict[str, Any]:
    """Move one of the user's Jira tasks to "In progress" (after a confirmation card).

    Args:
        issue_key: Exact task key such as "LST-1432" from my_tasks; never guess it.
    """
    deps = ctx.deps
    key = issue_key.strip().upper()
    async with deps.db.unit_of_work() as uow:
        service = DevFlowService(uow, deps.corp, access_sla_hours=_sla(ctx))
        try:
            if not ctx.tool_call_approved:
                overview = await service.overview(deps.actor)
            else:
                issue = await service.start_issue(
                    deps.actor, key, idempotency_key=ctx.tool_call_id or ""
                )
        except CorpUnavailableError:
            return {"message": "Jira сейчас не отвечает. " + UNAVAILABLE, "error": "unavailable"}
        except DomainError as exc:
            return {"message": exc.detail, "error": exc.error_code.value}
    if not ctx.tool_call_approved:
        found = next((i for i in overview.issues if i.key == key), None)
        if found is None:
            return {"message": f"Задачи {key} на тебе нет. Посмотри ключ в списке задач."}
        if found.status is not IssueStatus.TODO:
            return {"message": f"{found.key} уже {found.status_title}."}
        card = ActionCard(
            kind="start_task",
            title=f"Взять в работу {found.key}",
            service="Jira",
            fields=[
                CardField("issue", "Задача", f"{found.key} «{found.title}»"),
                CardField("status", "Статус", "к выполнению → в работе"),
                CardField("branch", "Ветка", found.branch),
            ],
            note="Статус увидит команда на доске. Шаг плана «первый PR» тоже станет «в работе».",
        )
        raise _card(card, {"issue_key": found.key})
    deps.emit("tasks", {"issues": [_issue_part(issue)], "pull_requests": []})
    return {
        "message": f"{issue.key} в работе. Создай ветку: `git checkout -b {issue.branch}` — "
        "так она свяжется с задачей. Когда откроешь PR, подберу ревьюеров.",
        "issue": _issue_part(issue),
    }


async def request_review(
    ctx: Ctx,
    pull_request: str | None = None,
    message: str | None = None,
    reviewers: list[str] | None = None,
) -> dict[str, Any]:
    """Pick reviewers for the user's open pull request (CODEOWNERS + required approvers) and,
    after a confirmation card, add them in Stash and notify them.

    Args:
        pull_request: PR id ("PR-87") or task key; leave empty for the user's open PR.
        message: A short note for reviewers in the user's words; leave empty to propose one.
        reviewers: Leave empty: reviewers are chosen by the rules and shown on the card.
    """
    deps = ctx.deps
    async with deps.db.unit_of_work() as uow:
        service = DevFlowService(uow, deps.corp, access_sla_hours=_sla(ctx))
        try:
            prep = await service.prepare_review(deps.actor, pull_request)
            if ctx.tool_call_approved:
                view = await service.create_review(
                    deps.actor,
                    pull_request=prep.pull.id,
                    reviewers=reviewers or [s.member.email for s in prep.suggestions],
                    message=message or "",
                    idempotency_key=ctx.tool_call_id or "",
                    source=RequestSource.AGENT,
                )
        except CorpUnavailableError:
            return {"message": "Stash сейчас не отвечает. " + UNAVAILABLE, "error": "unavailable"}
        except DomainError as exc:
            return {"message": exc.detail, "error": exc.error_code.value}
    if not ctx.tool_call_approved:
        if prep.existing is not None:
            return {
                "message": f"Ревью {prep.pull.id} уже запрошено ({prep.existing.external_id}), "
                f"ждём: {prep.existing.approver}.",
                "request": request_part(prep.existing),
            }
        note = message or f"Посмотрите, пожалуйста, {prep.pull.id}: {prep.pull.title}."
        card = ActionCard(
            kind="request_review",
            title=f"Ревью {prep.pull.id}",
            service=CODE_SERVICE,
            fields=[
                CardField("pull_request", "PR", f"{prep.pull.id} «{prep.pull.title}»"),
                CardField("target", "Куда", f"{prep.pull.branch} → {prep.pull.target}"),
                CardField(
                    "reviewers",
                    "Ревьюеры",
                    "; ".join(f"{s.member.name} — {s.reason}" for s in prep.suggestions),
                ),
                CardField("message", "Сообщение ревьюерам", note, editable=True),
            ],
            warnings=prep.warnings,
            note=(
                "Добавлю ревьюеров в PR, они получат уведомление в мессенджере. "
                "Вердикт придёт в «Мои заявки»."
            ),
        )
        raise _card(
            card,
            {
                "pull_request": prep.pull.id,
                "message": note,
                "reviewers": [s.member.email for s in prep.suggestions],
            },
        )
    view = await _submit_now(ctx, view)
    deps.emit("request", request_part(view))
    return {"message": _request_message(view), "request": request_part(view)}


# ---- office ------------------------------------------------------------------------------------


def _booking_day(ctx: Ctx, day: date | None) -> date:
    if day is not None:
        return day
    today = ctx.deps.today
    return today if today.weekday() < WORKING_WEEK else _next_working_day(today)


async def find_workspace(
    ctx: Ctx,
    *,
    kind: Literal["desk", "room"] = "room",
    day: date | None = None,
    start_time: str | None = None,
    duration_minutes: int = 30,
    with_mentor: bool = False,
) -> dict[str, Any]:
    """Free desks for a day, or free meeting rooms (with a time both you and the mentor are free).

    Args:
        kind: "desk" for a workplace for the day, "room" for a meeting room.
        day: Date; empty means today (or the next working day).
        start_time: "HH:MM" if the user named a time; empty to find the first common free slot.
        with_mentor: True for a meeting with the mentor (their calendar is checked too).
    """
    deps = ctx.deps
    async with deps.db.unit_of_work() as uow:
        try:
            option = await OfficeService(uow, deps.corp, access_sla_hours=_sla(ctx)).options(
                deps.actor,
                kind=BookingKind(kind),
                day=_booking_day(ctx, day),
                start=start_time,
                minutes=duration_minutes,
                with_mentor=with_mentor,
                today=deps.today,
            )
        except CorpUnavailableError:
            return {"message": "Сервис бронирования не отвечает. " + UNAVAILABLE}
        except DomainError as exc:
            return {"message": exc.detail, "error": exc.error_code.value}
    if option.kind is BookingKind.DESK:
        names = ", ".join(f"{d.name} ({d.zone})" for d in option.desks)
        return {
            "message": f"Свободные места на {option.day:%d.%m}: {names}. Забронировать?",
            "options": [d.id for d in option.desks],
        }
    rooms = ", ".join(f"{r.name} (до {r.capacity} чел.)" for r in option.rooms)
    who = f" — вы с {option.attendees[0].name} оба свободны" if option.attendees else ""
    return {
        "message": f"{option.day:%d.%m} {option.start}–{option.end}{who}. Свободны: {rooms}. "
        "Забронировать?",
        "start": option.start,
        "options": [r.id for r in option.rooms],
    }


async def book_workspace(
    ctx: Ctx,
    *,
    kind: Literal["desk", "room"] = "room",
    day: date | None = None,
    start_time: str | None = None,
    duration_minutes: int = 30,
    with_mentor: bool = False,
    title: str | None = None,
    resource: str | None = None,
) -> dict[str, Any]:
    """Book a desk or a meeting room after a confirmation card; with_mentor invites the mentor
    to a slot free in both calendars.

    Args:
        kind: "desk" or "room".
        day: Date; empty means today (or the next working day).
        start_time: "HH:MM" if the user named a time; empty to pick the first common free slot.
        with_mentor: True for a 1:1 or any meeting with the mentor.
        title: Meeting topic in the user's words; empty for a default.
        resource: Leave empty; the best free room or desk is chosen and shown on the card.
    """
    deps = ctx.deps
    booking_kind = BookingKind(kind)
    on = _booking_day(ctx, day)
    topic = title or (MENTOR_MEETING if with_mentor else "Встреча")
    async with deps.db.unit_of_work() as uow:
        service = OfficeService(uow, deps.corp, access_sla_hours=_sla(ctx))
        try:
            if not ctx.tool_call_approved:
                option = await service.options(
                    deps.actor,
                    kind=booking_kind,
                    day=on,
                    start=start_time,
                    minutes=duration_minutes,
                    with_mentor=with_mentor,
                    today=deps.today,
                )
            else:
                end = end_time(start_time or "09:00", duration_minutes)
                view = await service.create(
                    deps.actor,
                    kind=booking_kind,
                    resource=resource or "",
                    day=on,
                    start=start_time or "09:00",
                    end=end if booking_kind is BookingKind.ROOM else "20:00",
                    title=topic,
                    with_mentor=with_mentor,
                    idempotency_key=ctx.tool_call_id or "",
                    source=RequestSource.AGENT,
                    today=deps.today,
                )
        except CorpUnavailableError:
            return {"message": "Сервис бронирования не отвечает. " + UNAVAILABLE}
        except DomainError as exc:
            return {"message": exc.detail, "error": exc.error_code.value}
    if not ctx.tool_call_approved:
        chosen_room = next((r for r in option.rooms if r.id == resource), None) or (
            option.rooms[0] if option.rooms else None
        )
        chosen_desk = next((d for d in option.desks if d.id == resource), None) or (
            option.desks[0] if option.desks else None
        )
        if booking_kind is BookingKind.ROOM and chosen_room is not None:
            place, place_id = f"{chosen_room.name}, {chosen_room.floor} этаж", chosen_room.id
            when = f"{option.day:%d.%m} {option.start}–{option.end}"
        else:
            assert chosen_desk is not None  # noqa: S101 - options() raises when nothing is free
            place, place_id = f"{chosen_desk.name}, {chosen_desk.zone}", chosen_desk.id
            when = f"{option.day:%d.%m}, весь день"
        fields = [
            CardField("place", BOOKING_TITLES[booking_kind], place),
            CardField("when", "Когда", when),
        ]
        if option.attendees:
            fields.append(
                CardField("attendees", "Приглашу", ", ".join(a.name for a in option.attendees))
            )
        if booking_kind is BookingKind.ROOM:
            fields.append(CardField("title", "Тема", topic, editable=True))
        card = ActionCard(
            kind="booking",
            title=f"Бронь: {place.split(',')[0]}",
            service=BOOKING_SERVICE,
            fields=fields,
            note=(
                "Встреча появится в календаре у вас обоих, приглашение нужно принять."
                if option.attendees
                else "Бронь подтверждается сразу."
            ),
        )
        raise _card(
            card,
            {
                "kind": booking_kind.value,
                "day": option.day.isoformat(),
                "start_time": option.start,
                "duration_minutes": duration_minutes,
                "with_mentor": with_mentor,
                "title": topic,
                "resource": place_id,
            },
        )
    view = await _submit_now(ctx, view)
    deps.emit("request", request_part(view))
    return {"message": _request_message(view), "request": request_part(view)}


# ---- learning and IDP --------------------------------------------------------------------------


async def my_learning(ctx: Ctx) -> dict[str, Any]:
    """Courses assigned to the user on the learning platform: deadlines, progress, links."""
    async with ctx.deps.db.unit_of_work() as uow:
        try:
            overview = await LearningService(
                uow, ctx.deps.corp, access_sla_hours=_sla(ctx)
            ).overview(ctx.deps.actor)
        except CorpUnavailableError:
            return {"message": "Учебная платформа не отвечает. " + UNAVAILABLE}
    courses = [
        {
            "id": c.id,
            "title": c.title,
            "status": c.status.value,
            "status_title": c.status_title,
            "due": c.due.isoformat() if c.due else None,
            "progress": c.progress,
            "mandatory": c.mandatory,
            "url": c.url,
            "soon": c.deadline_soon(ctx.deps.today),
        }
        for c in overview.courses
    ]
    ctx.deps.emit("learning", {"courses": courses, "goals": []})
    if not courses:
        return {"message": "Назначенных курсов нет. Могу подобрать курс по теме.", "courses": []}
    lines = []
    for course in overview.courses:
        line = f"• «{course.title}» — {course.status_title}, {course.progress}%"
        if course.due and course.status is not CourseStatus.COMPLETED:
            line += f", дедлайн {course.due:%d.%m}"
        if course.deadline_soon(ctx.deps.today):
            line += " ⚠ скоро"
        lines.append(line)
    return {"message": "Твои курсы:\n" + "\n".join(lines), "courses": courses}


async def find_courses(ctx: Ctx, query: str) -> dict[str, Any]:
    """Search the course catalog by topic ("Go", "Kubernetes", "архитектура")."""
    async with ctx.deps.db.unit_of_work() as uow:
        try:
            found = await LearningService(uow, ctx.deps.corp, access_sla_hours=_sla(ctx)).catalog(
                ctx.deps.actor, query
            )
        except CorpUnavailableError:
            return {"message": "Учебная платформа не отвечает. " + UNAVAILABLE}
    if not found:
        return {"message": "По этой теме курсов в каталоге нет.", "courses": []}
    lines = [
        f"• «{c.title}» — {c.provider}, {c.hours} ч"
        + (", нужно согласование руководителя" if c.external else "")
        + (" (уже записан)" if c.enrolled else "")
        for c in found
    ]
    return {
        "message": "Нашёл в каталоге:\n" + "\n".join(lines) + "\nЗаписать на какой-то из них?",
        "courses": [c.id for c in found],
    }


async def enroll_course(  # noqa: PLR0911 - one answer per outcome reads best
    ctx: Ctx, course: str
) -> dict[str, Any]:
    """Enroll the user in a course after a confirmation card; external courses go to the lead.

    Args:
        course: Course id from the catalog or its name/topic in the user's words.
    """
    deps = ctx.deps
    async with deps.db.unit_of_work() as uow:
        service = LearningService(uow, deps.corp, access_sla_hours=_sla(ctx))
        try:
            if not ctx.tool_call_approved:
                prep = await service.prepare(deps.actor, course)
            else:
                view = await service.enroll(
                    deps.actor,
                    course=course,
                    idempotency_key=ctx.tool_call_id or "",
                    source=RequestSource.AGENT,
                )
        except CorpUnavailableError:
            return {"message": "Учебная платформа не отвечает. " + UNAVAILABLE}
        except DomainError as exc:
            return {"message": exc.detail, "error": exc.error_code.value}
    if not ctx.tool_call_approved:
        if prep.course is None:
            if not prep.candidates:
                return {"message": "Такого курса не нашёл. Скажи тему — поищу в каталоге."}
            names = "; ".join(f"«{c.title}»" for c in prep.candidates)
            return {"message": f"Уточни, какой курс: {names}?"}
        chosen = prep.course
        if prep.existing is not None:
            return {
                "message": f"Заявка на «{chosen.title}» уже на согласовании "
                f"({prep.existing.external_id or 'отправляется'}).",
                "request": request_part(prep.existing),
            }
        if chosen.enrolled:
            return {"message": f"Ты уже записан на «{chosen.title}». Список — в «Моих курсах»."}
        card = ActionCard(
            kind="enroll_course",
            title=f"Запись на курс «{chosen.title}»",
            service="Учебная платформа",
            fields=[
                CardField("course", "Курс", chosen.title),
                CardField("format", "Формат", f"{chosen.provider}, {chosen.hours} ч"),
                CardField("approver", "Согласует", prep.approver),
            ],
            note=(
                "Внешний курс оплачивается из бюджета обучения: заявка уйдёт руководителю."
                if chosen.external
                else "Доступ откроется сразу, курс появится в плане со сроком две недели."
            ),
        )
        raise _card(card, {"course": chosen.id})
    view = await _submit_now(ctx, view)
    deps.emit("request", request_part(view))
    return {"message": _request_message(view), "request": request_part(view)}


async def my_development_plan(ctx: Ctx) -> dict[str, Any]:
    """The user's individual development plan (IDP): goals, competencies, due dates, progress."""
    async with ctx.deps.db.unit_of_work() as uow:
        try:
            overview = await LearningService(
                uow, ctx.deps.corp, access_sla_hours=_sla(ctx)
            ).overview(ctx.deps.actor)
        except CorpUnavailableError:
            return {"message": "Инструмент прогресса не отвечает. " + UNAVAILABLE}
    goals = [
        {
            "goal": g.goal,
            "competency": g.competency,
            "level": g.level,
            "due": g.due.isoformat() if g.due else None,
            "progress": g.progress,
            "status": g.status.value,
            "status_title": g.status_title,
        }
        for g in overview.goals
    ]
    ctx.deps.emit("learning", {"courses": [], "goals": goals})
    if not goals:
        return {
            "message": "ИПР пока не заполнен. Цели фиксируют с руководителем на первой неделе — "
            "могу напомнить наставнику.",
            "goals": [],
        }
    lines = [
        f"• {g.goal} — {g.competency}, {g.status_title}, {g.progress}%"
        + (f", до {g.due:%d.%m}" if g.due else "")
        for g in overview.goals
    ]
    return {"message": "Твой ИПР:\n" + "\n".join(lines), "goals": goals}


WORK_TOOLS = (
    my_tasks,
    repository_guide,
    start_task,
    request_review,
    find_workspace,
    book_workspace,
    my_learning,
    find_courses,
    enroll_course,
    my_development_plan,
)
