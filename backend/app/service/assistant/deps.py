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
    "check_absence": Permission.REQUESTS_OWN,
    "request_absence": Permission.REQUESTS_OWN,
    "equipment_status": Permission.REQUESTS_OWN,
    "create_it_ticket": Permission.REQUESTS_OWN,
    "post_team_message": Permission.REQUESTS_OWN,
    "ask_mentor": Permission.ESCALATIONS_CREATE,
    "who_is_who": Permission.ASSISTANT_USE,
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
    "check_absence": "Проверяю остаток дней и календарь",
    "request_absence": "Готовлю заявку на отсутствие",
    "equipment_status": "Узнаю статус техники",
    "create_it_ticket": "Готовлю обращение в IT",
    "post_team_message": "Готовлю сообщение команде",
    "ask_mentor": "Готовлю вопрос наставнику",
    "who_is_who": "Смотрю контакты",
    "list_mentees": "Смотрю подопечных",
    "open_questions": "Смотрю вопросы стажёров",
    "answer_question": "Готовлю ответ стажёру",
}
