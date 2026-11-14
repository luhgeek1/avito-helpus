from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ChatMessage, Conversation, PendingAction
from app.domain.assistant import ActionStatus


class AssistantRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add_conversation(self, conversation: Conversation) -> None:
        self._session.add(conversation)

    def add_message(self, message: ChatMessage) -> None:
        self._session.add(message)

    def add_action(self, action: PendingAction) -> None:
        self._session.add(action)

    async def conversation(
        self, conversation_id: UUID, user_id: UUID, *, for_update: bool = False
    ) -> Conversation | None:
        stmt = select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == user_id
        )
        if for_update:
            stmt = stmt.with_for_update().execution_options(populate_existing=True)
        return await self._session.scalar(stmt)

    async def conversations(self, user_id: UUID, *, limit: int = 30) -> Sequence[Conversation]:
        stmt = (
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
        )
        return (await self._session.scalars(stmt)).all()

    async def messages(self, conversation_id: UUID) -> Sequence[ChatMessage]:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.created_at, ChatMessage.id)
        )
        return (await self._session.scalars(stmt)).all()

    async def message_for_user(self, message_id: UUID, user_id: UUID) -> ChatMessage | None:
        stmt = (
            select(ChatMessage)
            .join(Conversation, ChatMessage.conversation_id == Conversation.id)
            .where(ChatMessage.id == message_id, Conversation.user_id == user_id)
        )
        return await self._session.scalar(stmt)

    async def action(
        self, action_id: UUID, user_id: UUID, *, for_update: bool = False
    ) -> PendingAction | None:
        stmt = select(PendingAction).where(
            PendingAction.id == action_id, PendingAction.user_id == user_id
        )
        if for_update:
            stmt = stmt.with_for_update().execution_options(populate_existing=True)
        return await self._session.scalar(stmt)

    async def pending_actions(self, conversation_id: UUID) -> Sequence[PendingAction]:
        stmt = select(PendingAction).where(
            PendingAction.conversation_id == conversation_id,
            PendingAction.status == ActionStatus.PENDING,
        )
        return (await self._session.scalars(stmt)).all()

    async def expire_actions(self, conversation_id: UUID, *, now: datetime) -> None:
        await self._session.execute(
            update(PendingAction)
            .where(
                PendingAction.conversation_id == conversation_id,
                PendingAction.status == ActionStatus.PENDING,
            )
            .values(status=ActionStatus.EXPIRED, decided_at=now)
        )
