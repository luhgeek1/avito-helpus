from datetime import date, datetime, timedelta
from uuid import uuid4

import pytest

from app.core.errors import ForbiddenError
from app.domain.absence import (
    AbsenceBalanceError,
    AbsenceDatesError,
    AbsenceType,
    CalendarEvent,
    evaluate_absence,
    parse_dates_ru,
    working_days,
)
from app.domain.assistant import ActionCard, CardField, apply_edits
from app.domain.escalations import (
    Chain,
    EscalationClosedError,
    EscalationKind,
    EscalationLevel,
    EscalationStatus,
    NoAssigneeError,
    ensure_can_answer,
    first_assignment,
    next_assignment,
)
from app.domain.flags import FlagState, bucket, evaluate
from app.domain.requests import (
    AccessLevel,
    AccessLevelNotAllowedError,
    AccessResource,
    ApproverRole,
    RequestStatus,
    RequestTransitionError,
    Sensitivity,
    access_justification,
    ensure_level_allowed,
    ensure_transition,
    match_resources,
    resource_visible,
)
from app.domain.users import (
    CurrentUser,
    MemberLinks,
    MenteeNotFoundError,
    Person,
    Role,
    can_review_member,
    can_view_member,
    ensure_can_view_member,
)

FRIDAY = date(2026, 11, 13)
TEAM = uuid4()


def resource(slug: str, name: str, system: str, **kw: object) -> AccessResource:
    return AccessResource(
        id=uuid4(),
        slug=slug,
        name=name,
        system=system,
        description="",
        team_id=kw.get("team_id", TEAM),  # type: ignore[arg-type]
        sensitivity=kw.get("sensitivity", Sensitivity.STANDARD),  # type: ignore[arg-type]
        approver_role=ApproverRole.TEAM_LEAD,
        default_level=AccessLevel.READ,
        aliases=tuple(kw.get("aliases", ())),  # type: ignore[call-overload]
    )


CATALOG = [
    resource("stash-listings-api", "Репозиторий listings-api", "Stash", aliases=["репо"]),
    resource("stash-listings-worker", "Репозиторий listings-worker", "Stash"),
    resource("grafana-listings", "Дашборды Grafana: Объявления", "Grafana", aliases=["графана"]),
    resource("jira-listings", "Jira-проект LST", "Jira"),
]


# ---- requests ------------------------------------------------------------------------------------


def test_request_lifecycle_rejects_illegal_moves() -> None:
    ensure_transition(RequestStatus.SUBMITTING, RequestStatus.SUBMITTED)
    ensure_transition(RequestStatus.SUBMITTED, RequestStatus.APPROVED)
    with pytest.raises(RequestTransitionError):
        ensure_transition(RequestStatus.APPROVED, RequestStatus.REJECTED)


def test_interns_do_not_get_admin_access() -> None:
    ensure_level_allowed(Role.INTERN, AccessLevel.WRITE)
    ensure_level_allowed(Role.LEAD, AccessLevel.ADMIN)
    with pytest.raises(AccessLevelNotAllowedError):
        ensure_level_allowed(Role.INTERN, AccessLevel.ADMIN)


def test_resource_visibility_follows_sensitivity_and_team() -> None:
    restricted = resource("prod", "Прод", "PG", sensitivity=Sensitivity.RESTRICTED)
    confidential = resource("hr", "HR", "HR", sensitivity=Sensitivity.CONFIDENTIAL, team_id=None)
    other_team = resource("pay", "Платежи", "Stash", team_id=uuid4())

    assert not resource_visible(restricted, role=Role.INTERN, team_id=TEAM)
    assert resource_visible(restricted, role=Role.MENTOR, team_id=TEAM)
    assert not resource_visible(confidential, role=Role.LEAD, team_id=TEAM)
    assert resource_visible(confidential, role=Role.HRBP, team_id=None)
    assert not resource_visible(other_team, role=Role.INTERN, team_id=TEAM)
    assert resource_visible(other_team, role=Role.ADMIN, team_id=None)


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("Нужен доступ к репозиторию listings-api", ["stash-listings-api"]),
        ("графана", ["grafana-listings"]),
        ("jira", ["jira-listings"]),
        ("репозиторий", ["stash-listings-api", "stash-listings-worker"]),
        ("кофемашина", []),
        ("", []),
    ],
)
def test_resource_matching(query: str, expected: list[str]) -> None:
    assert [r.slug for r in match_resources(query, CATALOG)] == expected


def test_default_justification_mentions_team_and_stage() -> None:
    text = access_justification(CATALOG[0], team_name="Объявления", stage="первая неделя")
    assert "Объявления" in text
    assert "первая неделя" in text


# ---- absence ------------------------------------------------------------------------------------


def test_working_days_skip_weekends() -> None:
    assert working_days(FRIDAY, FRIDAY + timedelta(days=3)) == 2


def test_absence_warns_about_late_notice_and_meetings() -> None:
    meeting = CalendarEvent("1:1 с наставником", datetime(2026, 11, 16, 15), important=True)
    standup = CalendarEvent("Стендап", datetime(2026, 11, 16, 11), important=False)

    check = evaluate_absence(
        type_=AbsenceType.DAY_OFF,
        start=date(2026, 11, 16),
        end=date(2026, 11, 16),
        today=FRIDAY,
        internship_start=FRIDAY - timedelta(days=2),
        balance=5,
        events=[meeting, standup],
    )

    assert check.working_days == 1
    assert check.balance_after == 4
    assert check.conflicts == [meeting]
    assert any("рабочих дня" in w for w in check.warnings)
    assert any("1:1" in w for w in check.warnings)


def test_vacation_in_the_first_months_is_flagged() -> None:
    check = evaluate_absence(
        type_=AbsenceType.VACATION,
        start=date(2026, 12, 1),
        end=date(2026, 12, 4),
        today=FRIDAY,
        internship_start=FRIDAY,
        balance=10,
        events=[],
    )
    assert any("первые три месяца" in w for w in check.warnings)
    assert check.title == "Отпуск 01.12–04.12.2026"


def test_absence_hard_errors() -> None:
    kwargs = {"type_": AbsenceType.DAY_OFF, "today": FRIDAY, "internship_start": None, "events": []}
    with pytest.raises(AbsenceDatesError):
        evaluate_absence(start=FRIDAY - timedelta(days=1), end=FRIDAY, balance=5, **kwargs)  # type: ignore[arg-type]
    with pytest.raises(AbsenceDatesError):
        evaluate_absence(start=date(2026, 11, 14), end=date(2026, 11, 15), balance=5, **kwargs)  # type: ignore[arg-type]
    with pytest.raises(AbsenceBalanceError):
        evaluate_absence(start=date(2026, 11, 16), end=date(2026, 11, 20), balance=2, **kwargs)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("отгул завтра", (date(2026, 11, 14), date(2026, 11, 14))),
        ("послезавтра", (date(2026, 11, 15), date(2026, 11, 15))),
        ("сегодня", (FRIDAY, FRIDAY)),
        ("в понедельник", (date(2026, 11, 16), date(2026, 11, 16))),
        ("в пятницу", (date(2026, 11, 20), date(2026, 11, 20))),
        ("отгул 20.11", (date(2026, 11, 20), date(2026, 11, 20))),
        ("с 20.11 по 22.11.26", (date(2026, 11, 20), date(2026, 11, 22))),
        ("отпуск с 1 по 5 декабря", (date(2026, 12, 1), date(2026, 12, 5))),
        ("3 мая", (date(2027, 5, 3), date(2027, 5, 3))),
        ("когда-нибудь", None),
    ],
)
def test_russian_dates(text: str, expected: tuple[date, date] | None) -> None:
    assert parse_dates_ru(text, FRIDAY) == expected


# ---- escalations --------------------------------------------------------------------------------


def test_escalation_ladder() -> None:
    mentor, lead, hrbp = uuid4(), uuid4(), uuid4()
    chain = Chain(mentor, lead, hrbp)

    assert first_assignment(EscalationKind.QUESTION, chain).assignee_id == mentor
    assert first_assignment(EscalationKind.SENSITIVE, chain).level is EscalationLevel.HRBP
    assert next_assignment(EscalationLevel.MENTOR, chain).assignee_id == lead  # type: ignore[union-attr]
    assert next_assignment(EscalationLevel.HRBP, chain) is None
    assert first_assignment(EscalationKind.QUESTION, Chain(None, lead, hrbp)).assignee_id == lead
    with pytest.raises(NoAssigneeError):
        first_assignment(EscalationKind.QUESTION, Chain(None, None, None))


def test_only_the_assignee_answers_open_questions() -> None:
    me = uuid4()
    ensure_can_answer(actor_id=me, assignee_id=me, status=EscalationStatus.OPEN)
    with pytest.raises(ForbiddenError):
        ensure_can_answer(actor_id=me, assignee_id=uuid4(), status=EscalationStatus.OPEN)
    with pytest.raises(EscalationClosedError):
        ensure_can_answer(actor_id=me, assignee_id=me, status=EscalationStatus.ANSWERED)


# ---- people, flags, cards ---------------------------------------------------------------------


def test_abac_for_people() -> None:
    mentor = CurrentUser(id=uuid4(), role=Role.MENTOR, session_id=uuid4())
    lead = CurrentUser(id=uuid4(), role=Role.LEAD, session_id=uuid4())
    hrbp = CurrentUser(id=uuid4(), role=Role.HRBP, session_id=uuid4())
    mentee = MemberLinks(
        id=uuid4(), team_id=TEAM, mentor_id=mentor.id, lead_id=lead.id, hrbp_id=hrbp.id
    )
    stranger = MemberLinks(id=uuid4(), team_id=None, mentor_id=uuid4(), lead_id=None, hrbp_id=None)

    assert can_view_member(mentor, mentee)
    assert can_view_member(lead, mentee)
    assert can_view_member(hrbp, mentee)
    assert not can_view_member(mentor, stranger)
    assert not can_view_member(hrbp, stranger)
    assert can_review_member(mentor, mentee)
    assert can_review_member(lead, mentee)
    assert not can_review_member(hrbp, mentee)
    with pytest.raises(MenteeNotFoundError):
        ensure_can_view_member(mentor, stranger)


def test_internship_day() -> None:
    person = Person(
        id=uuid4(), email="a@b.test", full_name="A", title="", role=Role.INTERN, track="backend",
        start_date=FRIDAY, team=None, mentor=None, lead=None, hrbp=None,
    )  # fmt: skip
    assert person.internship_day(FRIDAY + timedelta(days=2)) == 3
    assert person.internship_day(FRIDAY - timedelta(days=1)) is None


def test_flags_bucket_whole_teams_deterministically() -> None:
    flag = FlagState(
        key="orbi", enabled=True, rollout_percent=50, variants=("a", "b"), description=""
    )
    decisions = {evaluate(flag, f"team-{i}").enabled for i in range(40)}

    assert decisions == {True, False}
    assert evaluate(flag, "listings") == evaluate(flag, "listings")
    assert bucket("orbi", "listings") == bucket("orbi", "listings")
    assert not evaluate(FlagState("x", False, 100, (), ""), "listings").enabled


def test_card_edits_are_whitelisted() -> None:
    args = {"resource": "stash", "level": "read", "justification": "x"}
    assert apply_edits("request_access", args, {"level": "write"})["level"] == "write"
    with pytest.raises(Exception, match="resource"):
        apply_edits("request_access", args, {"resource": "prod-db"})
    card = ActionCard("k", "t", "s", [CardField("a", "A", "1", editable=True)], ["w"])
    assert card.as_dict()["fields"][0]["editable"] is True
