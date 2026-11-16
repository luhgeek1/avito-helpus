from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import UUID

from app.core.config import Settings
from app.db.database import Database
from app.domain.plan import PlanItemView
from app.domain.users import CurrentUser, Permission, Person
from app.service.ports import CorpServices, Embeddings


@dataclass(slots=True)
class AgentDeps:
    """Everything a tool needs. Tools own their transactions: each call opens its own UoW."""

    actor: CurrentUser
    person: Person
    db: Database
    corp: CorpServices
    embeddings: Embeddings | None
    settings: Settings
    conversation_id: UUID
    today: date
    stage_title: str
    next_steps: list[PlanItemView]
    # What the user said last: tools check relevance against it, not only the model's rewrite.
    user_text: str = ""
    # Data parts tools want to show next to the answer (sources, request cards...).
    parts: list[dict[str, Any]] = field(default_factory=list)

    def emit(self, part_type: str, data: Mapping[str, Any]) -> None:
        self.parts.append({"type": f"data-{part_type}", "data": dict(data)})

    def drain(self) -> list[dict[str, Any]]:
        parts, self.parts = self.parts, []
        return parts


# Which permission a tool needs. A tool the user may not use is never offered to the model.
TOOL_PERMISSIONS: Mapping[str, Permission] = {
    "get_my_plan": Permission.PLAN_OWN,
    "update_plan_step": Permission.PLAN_OWN,
    "search_knowledge": Permission.KNOWLEDGE_READ,
    "find_access_resources": Permission.REQUESTS_OWN,
    "request_access": Permission.REQUESTS_OWN,
    "my_requests": Permission.REQUESTS_OWN,
    "control_request": Permission.REQUESTS_OWN,
    "my_calendar": Permission.REQUESTS_OWN,
    "absence_balance": Permission.REQUESTS_OWN,
    "check_absence": Permission.REQUESTS_OWN,
    "request_absence": Permission.REQUESTS_OWN,
    "equipment_status": Permission.REQUESTS_OWN,
    "create_it_ticket": Permission.REQUESTS_OWN,
    "post_team_message": Permission.REQUESTS_OWN,
    "ask_mentor": Permission.ESCALATIONS_CREATE,
    "who_is_who": Permission.ASSISTANT_USE,
    "my_tasks": Permission.REQUESTS_OWN,
    "repository_guide": Permission.REQUESTS_OWN,
    "start_task": Permission.REQUESTS_OWN,
    "request_review": Permission.REQUESTS_OWN,
    "find_workspace": Permission.REQUESTS_OWN,
    "book_workspace": Permission.REQUESTS_OWN,
    "my_learning": Permission.PLAN_OWN,
    "find_courses": Permission.PLAN_OWN,
    "enroll_course": Permission.PLAN_OWN,
    "my_development_plan": Permission.PLAN_OWN,
    "list_mentees": Permission.MENTEES_READ,
    "open_questions": Permission.ESCALATIONS_ANSWER,
    "answer_question": Permission.ESCALATIONS_ANSWER,
}

TOOL_LABELS: Mapping[str, str] = {
    "get_my_plan": "Смотрю твой план",
    "update_plan_step": "Обновляю шаг плана",
    "search_knowledge": "Ищу в базе знаний",
    "find_access_resources": "Ищу ресурс в каталоге доступов",
    "request_access": "Готовлю заявку на доступ",
    "my_requests": "Смотрю твои заявки",
    "control_request": "Готовлю действие с заявкой",
    "my_calendar": "Смотрю твой календарь",
    "absence_balance": "Смотрю остаток дней",
    "check_absence": "Проверяю остаток дней и календарь",
    "request_absence": "Готовлю заявку на отсутствие",
    "equipment_status": "Узнаю статус техники",
    "create_it_ticket": "Готовлю обращение в IT",
    "post_team_message": "Готовлю сообщение команде",
    "ask_mentor": "Готовлю вопрос наставнику",
    "who_is_who": "Смотрю контакты",
    "my_tasks": "Смотрю задачи в Jira и PR в Stash",
    "repository_guide": "Смотрю репозиторий в Stash",
    "start_task": "Готовлю перевод задачи в работу",
    "request_review": "Подбираю ревьюеров по CODEOWNERS",
    "find_workspace": "Ищу свободное место и время",
    "book_workspace": "Готовлю бронь",
    "my_learning": "Смотрю курсы на учебной платформе",
    "find_courses": "Ищу курсы в каталоге",
    "enroll_course": "Готовлю запись на курс",
    "my_development_plan": "Смотрю твой ИПР",
    "list_mentees": "Смотрю подопечных",
    "open_questions": "Смотрю вопросы стажёров",
    "answer_question": "Готовлю ответ стажёру",
}
