from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.assistant import AssistantRepository
from app.db.repositories.escalations import EscalationRepository
from app.db.repositories.knowledge import KnowledgeRepository
from app.db.repositories.notifications import NotificationRepository
from app.db.repositories.ops import OpsRepository
from app.db.repositories.outbox import OutboxRepository
from app.db.repositories.people import PeopleRepository
from app.db.repositories.plan import PlanRepository
from app.db.repositories.requests import RequestRepository
from app.db.repositories.sessions import SessionRepository


class UnitOfWork:
    """
    One session = one transaction, plus the repositories bound to it.
    Services only `flush()`; the owner of the UoW (request dependency, worker, CLI, agent tool)
    commits.
    """

    def __init__(self, session: AsyncSession, *, export_key: bytes | None = None) -> None:
        self.session = session
        self.people = PeopleRepository(session)
        self.sessions = SessionRepository(session)
        self.outbox = OutboxRepository(session)
        self.plan = PlanRepository(session)
        self.requests = RequestRepository(session)
        self.knowledge = KnowledgeRepository(session)
        self.escalations = EscalationRepository(session)
        self.notifications = NotificationRepository(session)
        self.assistant = AssistantRepository(session)
        self.ops = OpsRepository(session, export_key=export_key)

    async def flush(self) -> None:
        await self.session.flush()
