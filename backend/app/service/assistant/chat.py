import logging
import time
from collections.abc import AsyncIterator, Callable, Mapping
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any
from uuid import UUID, uuid4

from pydantic_ai import (
    AgentRunResultEvent,
    DeferredToolRequests,
    DeferredToolResults,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    ModelMessagesTypeAdapter,
    ModelRequest,
    ModelResponse,
    PartDeltaEvent,
    PartEndEvent,
    PartStartEvent,
    RetryPromptPart,
    TextPart,
    TextPartDelta,
    ToolApproved,
    ToolCallPart,
    ToolDenied,
    ToolReturnPart,
    UsageLimits,
)
from pydantic_ai.models import Model
from pydantic_core import to_jsonable_python

from app.core.clock import utcnow
from app.core.config import Settings
from app.db.database import Database
from app.db.models import ChatMessage, Conversation, PendingAction
from app.db.uow import UnitOfWork
from app.domain.assistant import (
    ActionAlreadyDecidedError,
    ActionExpiredError,
    ActionNotFoundError,
    ActionStatus,
    AssistantMode,
    ChatMessageView,
    ConversationNotFoundError,
    ConversationSummary,
    Decision,
    apply_edits,
)
from app.domain.events import AnalyticsEvent, AuditAction
from app.domain.plan import STAGE_TITLES
from app.domain.users import CurrentUser
from app.infra.metrics import ACTIONS, CHAT_FIRST_TOKEN, CHAT_TURNS, LLM_FALLBACKS, TOOL_CALLS
from app.service.assistant import stream
from app.service.assistant.agent import OrbiAgent
from app.service.assistant.deps import TOOL_LABELS, AgentDeps
from app.service.assistant.offline import OFFLINE_MODEL_NAME
from app.service.people import PeopleService
from app.service.plan import PlanService
from app.service.ports import CorpServices, Embeddings

logger = logging.getLogger(__name__)

TITLE_MAX = 60
LIMITS = UsageLimits(request_limit=8, tool_calls_limit=8)
DENIED = "Пользователь отклонил действие — ничего не отправлено."
CONFIRM_PROMPT = "Подготовил — проверь карточку и подтверди. Без подтверждения ничего не отправлю."
SUPERSEDED = "Пользователь не подтвердил карточку и продолжил разговор — действие не выполнено."


@dataclass(frozen=True, slots=True)
class ChatRuntime:
    """Long-lived pieces of the assistant, built once in the app factory."""

    agent: OrbiAgent
    model: Model
    db: Database
    corp: CorpServices
    embeddings: Embeddings | None
    settings: Settings
    online: bool
    today: Callable[[], date]

    @property
    def mode(self) -> AssistantMode:
        return AssistantMode.ONLINE if self.online else AssistantMode.OFFLINE


@dataclass(slots=True)
class _Turn:
    """What one streamed turn produced, to be saved when it ends."""

    message_id: str
    texts: list[str]
    parts: list[dict[str, Any]]
    first_token_at: float | None = None
    fell_back: bool = False


class ChatService:
    def __init__(self, runtime: ChatRuntime) -> None:
        self._rt = runtime

    # ---- conversations -------------------------------------------------------------------

    async def create(self, actor: CurrentUser) -> ConversationSummary:
        async with self._rt.db.unit_of_work() as uow:
            conversation = Conversation(user_id=actor.id, title="Новый диалог", model_history=[])
            uow.assistant.add_conversation(conversation)
            await uow.flush()
            return _summary(conversation)

    async def conversations(self, actor: CurrentUser) -> list[ConversationSummary]:
        async with self._rt.db.unit_of_work() as uow:
            return [_summary(c) for c in await uow.assistant.conversations(actor.id)]

    async def history(
        self, actor: CurrentUser, conversation_id: UUID
    ) -> tuple[ConversationSummary, list[ChatMessageView]]:
        async with self._rt.db.unit_of_work() as uow:
            conversation = await _conversation(uow, actor, conversation_id)
            messages = await uow.assistant.messages(conversation.id)
            actions = {str(a.id): a for a in await _actions_of(uow, conversation.id, messages)}
            views = [
                ChatMessageView(
                    id=m.id,
                    role=m.role,
                    parts=[_refresh_action(part, actions) for part in m.parts],
                    feedback=m.feedback,
                    created_at=m.created_at,
                )
                for m in messages
            ]
            return _summary(conversation), views

    async def feedback(
        self, actor: CurrentUser, message_id: UUID, *, rating: str, comment: str | None
    ) -> None:
        async with self._rt.db.unit_of_work() as uow:
            message = await uow.assistant.message_for_user(message_id, actor.id)
            if message is None or message.role != "assistant":
                raise ConversationNotFoundError("Message not found")
            message.feedback = rating
            message.feedback_comment = comment
            uow.ops.track(
                AnalyticsEvent.ANSWER_FEEDBACK,
                user_id=actor.id,
                properties={"rating": rating, "message_id": str(message_id)},
            )

    # ---- turns ---------------------------------------------------------------------------

    async def prepare_message(
        self, actor: CurrentUser, conversation_id: UUID, text: str
    ) -> DeferredToolResults | None:
        """Validate before streaming (404 must be a normal response) and expire stale cards."""
        async with self._rt.db.unit_of_work() as uow:
            conversation = await _conversation(uow, actor, conversation_id)
            pending = await uow.assistant.pending_actions(conversation.id)
            uow.assistant.add_message(
                ChatMessage(
                    conversation_id=conversation.id,
                    role="user",
                    parts=[{"type": "text", "text": text}],
                )
            )
            if conversation.title in {"", "Новый диалог"}:
                conversation.title = text if len(text) <= TITLE_MAX else text[: TITLE_MAX - 1] + "…"
            if not pending:
                return None
            await uow.assistant.expire_actions(conversation.id, now=utcnow())
            return DeferredToolResults(
                approvals={a.tool_call_id: ToolDenied(SUPERSEDED) for a in pending}
            )

    async def prepare_decision(
        self,
        actor: CurrentUser,
        conversation_id: UUID,
        action_id: UUID,
        *,
        decision: Decision,
        edits: Mapping[str, Any],
    ) -> DeferredToolResults:
        async with self._rt.db.unit_of_work() as uow:
            conversation = await _conversation(uow, actor, conversation_id)
            action = await uow.assistant.action(action_id, actor.id, for_update=True)
            if action is None or action.conversation_id != conversation.id:
                raise ActionNotFoundError()
            if action.status is not ActionStatus.PENDING:
                raise ActionAlreadyDecidedError()
            now = utcnow()
            if action.expires_at < now:
                action.status = ActionStatus.EXPIRED
                action.decided_at = now
                raise ActionExpiredError()
            approvals: dict[str, bool | ToolApproved | ToolDenied] = {}
            if decision is Decision.APPROVE:
                args = apply_edits(action.tool_name, action.args, edits)
                action.args = args
                approvals[action.tool_call_id] = ToolApproved(override_args=args)
            else:
                approvals[action.tool_call_id] = ToolDenied(DENIED)
            action.status = (
                ActionStatus.APPROVED if decision is Decision.APPROVE else ActionStatus.REJECTED
            )
            action.decided_at = now
            # Cards proposed in the same run can't stay open once the run resumes.
            for other in await uow.assistant.pending_actions(conversation.id):
                if other.id != action.id:
                    other.status = ActionStatus.EXPIRED
                    other.decided_at = now
                    approvals[other.tool_call_id] = ToolDenied(SUPERSEDED)
            uow.assistant.add_message(
                ChatMessage(
                    conversation_id=conversation.id,
                    role="user",
                    parts=[
                        {
                            "type": "data-decision",
                            "data": {
                                "action_id": str(action.id),
                                "decision": decision.value,
                                "edits": dict(edits),
                            },
                        }
                    ],
                )
            )
            audit = (
                AuditAction.ACTION_APPROVED
                if decision is Decision.APPROVE
                else AuditAction.ACTION_REJECTED
            )
            uow.ops.audit(
                audit,
                actor_id=actor.id,
                target_type="pending_action",
                target_id=str(action.id),
                details={"tool": action.tool_name, "args": action.args},
            )
            uow.ops.track(
                AnalyticsEvent.ACTION_DECIDED,
                user_id=actor.id,
                properties={"tool": action.tool_name, "decision": decision.value},
            )
            ACTIONS.labels(tool=action.tool_name, decision=decision.value).inc()
            return DeferredToolResults(approvals=approvals)

    async def stream_turn(
        self,
        actor: CurrentUser,
        conversation_id: UUID,
        *,
        prompt: str | None,
        deferred: DeferredToolResults | None,
    ) -> AsyncIterator[str]:
        turn = _Turn(message_id=uuid4().hex, texts=[], parts=[])
        started = time.perf_counter()
        yield stream.start(turn.message_id, {"mode": self._rt.mode.value})
        yield stream.status("Думаю…", mode=self._rt.mode.value)
        try:
            deps, history = await self._load(actor, conversation_id)
            deferred = _close_dangling(history, deferred)
            async with self._rt.agent.run_stream_events(
                prompt,
                message_history=history,
                deferred_tool_results=deferred,
                deps=deps,
                model=self._rt.model,
                usage_limits=LIMITS,
            ) as events:
                async for event in events:
                    for chunk in self._encode(event, deps, turn, started):
                        yield chunk
                    if isinstance(event, AgentRunResultEvent):
                        async for chunk in self._finish(actor, conversation_id, event, turn):
                            yield chunk
        except Exception as exc:  # any failure becomes a visible, retryable error in the chat
            logger.exception("assistant turn failed")
            CHAT_TURNS.labels(mode=self._rt.mode.value, outcome="error").inc()
            yield stream.error("Орби сейчас не может ответить. Попробуй ещё раз через минуту.")
            await self._save_failure(conversation_id, turn, repr(exc))
        yield stream.finish(
            {
                "mode": "offline" if turn.fell_back else self._rt.mode.value,
                "messageId": turn.message_id,
            }
        )
        yield stream.DONE

    # ---- internals -----------------------------------------------------------------------

    async def _load(self, actor: CurrentUser, conversation_id: UUID) -> tuple[AgentDeps, list[Any]]:
        today = self._rt.today()
        async with self._rt.db.unit_of_work() as uow:
            conversation = await _conversation(uow, actor, conversation_id)
            history = ModelMessagesTypeAdapter.validate_python(conversation.model_history)
            person = await PeopleService(uow).person(actor.id)
            plan = await PlanService(uow).overview(actor.id, on=today)
        deps = AgentDeps(
            actor=actor,
            person=person,
            db=self._rt.db,
            corp=self._rt.corp,
            embeddings=self._rt.embeddings,
            settings=self._rt.settings,
            conversation_id=conversation_id,
            today=today,
            stage_title=STAGE_TITLES[plan.current_stage],
            next_steps=plan.next_steps,
        )
        return deps, list(history)

    def _encode(self, event: Any, deps: AgentDeps, turn: _Turn, started: float) -> list[str]:
        chunks: list[str] = []
        if isinstance(event, PartStartEvent) and isinstance(event.part, TextPart):
            part_id = f"{turn.message_id}-t{len(turn.texts)}"
            turn.texts.append(event.part.content)
            chunks.append(stream.text_start(part_id))
            if event.part.content:
                self._first_token(turn, started)
                chunks.append(stream.text_delta(part_id, event.part.content))
        elif (
            isinstance(event, PartDeltaEvent)
            and isinstance(event.delta, TextPartDelta)
            and turn.texts
        ):
            self._first_token(turn, started)
            turn.texts[-1] += event.delta.content_delta
            chunks.append(
                stream.text_delta(
                    f"{turn.message_id}-t{len(turn.texts) - 1}", event.delta.content_delta
                )
            )
        elif isinstance(event, PartEndEvent) and isinstance(event.part, TextPart) and turn.texts:
            chunks.append(stream.text_end(f"{turn.message_id}-t{len(turn.texts) - 1}"))
        elif isinstance(event, FunctionToolCallEvent):
            name = event.part.tool_name
            chunks.append(stream.status(TOOL_LABELS.get(name, "Работаю…")))
            chunks.append(
                stream.tool_input(event.part.tool_call_id, name, event.part.args_as_dict())
            )
        elif isinstance(event, FunctionToolResultEvent):
            content = getattr(event.part, "content", None)
            name = getattr(event.part, "tool_name", "")
            TOOL_CALLS.labels(
                tool=name,
                outcome="ok" if isinstance(content, dict) and not content.get("error") else "info",
            ).inc()
            chunks.append(stream.tool_output(event.tool_call_id, _public_output(content)))
            for part in deps.drain():
                turn.parts.append(part)
                chunks.append(stream.data(part["type"], part["data"]))
        return chunks

    def _first_token(self, turn: _Turn, started: float) -> None:
        if turn.first_token_at is None:
            turn.first_token_at = time.perf_counter()
            CHAT_FIRST_TOKEN.labels(mode=self._rt.mode.value).observe(turn.first_token_at - started)

    async def _finish(
        self,
        actor: CurrentUser,
        conversation_id: UUID,
        event: AgentRunResultEvent[Any],
        turn: _Turn,
    ) -> AsyncIterator[str]:
        result = event.result
        new_messages = result.new_messages()
        turn.fell_back = self._rt.online and any(
            isinstance(m, ModelResponse) and m.model_name == OFFLINE_MODEL_NAME
            for m in new_messages
        )
        if turn.fell_back:
            LLM_FALLBACKS.inc()
            yield stream.status("Работаю в офлайн-режиме: модель недоступна", mode="offline")
        output = result.output
        async with self._rt.db.unit_of_work() as uow:
            conversation = await _conversation(uow, actor, conversation_id)
            if isinstance(output, DeferredToolRequests):
                if not any(text.strip() for text in turn.texts):
                    for chunk in _say(turn, CONFIRM_PROMPT):
                        yield chunk
                for call in output.approvals:
                    meta = output.metadata.get(call.tool_call_id, {})
                    action = PendingAction(
                        conversation_id=conversation.id,
                        user_id=actor.id,
                        tool_call_id=call.tool_call_id,
                        tool_name=call.tool_name,
                        args=meta.get("args") or call.args_as_dict(),
                        card=meta.get("card") or {"title": call.tool_name, "fields": []},
                        expires_at=utcnow() + timedelta(minutes=self._rt.settings.action_ttl_min),
                    )
                    uow.assistant.add_action(action)
                    await uow.flush()
                    part: dict[str, Any] = {"type": "data-action", "data": _action_data(action)}
                    turn.parts.append(part)
                    uow.ops.track(
                        AnalyticsEvent.ACTION_PROPOSED,
                        user_id=actor.id,
                        properties={"tool": call.tool_name},
                    )
                    yield stream.data(part["type"], part["data"])
            conversation.model_history = to_jsonable_python(result.all_messages())
            conversation.updated_at = utcnow()
            uow.assistant.add_message(
                ChatMessage(
                    conversation_id=conversation.id, role="assistant", parts=_ui_parts(turn)
                )
            )
            uow.ops.track(
                AnalyticsEvent.CHAT_MESSAGE,
                user_id=actor.id,
                properties={
                    "mode": "offline" if turn.fell_back else self._rt.mode.value,
                    "tools": [p["type"] for p in turn.parts],
                },
            )
            if turn.fell_back:
                uow.ops.track(AnalyticsEvent.CHAT_FALLBACK, user_id=actor.id)
        CHAT_TURNS.labels(mode=self._rt.mode.value, outcome="ok").inc()

    async def _save_failure(self, conversation_id: UUID, turn: _Turn, error: str) -> None:
        try:
            async with self._rt.db.unit_of_work() as uow:
                parts = [
                    *_ui_parts(turn),
                    {"type": "data-error", "data": {"text": "Ответ прервался"}},
                ]
                uow.assistant.add_message(
                    ChatMessage(conversation_id=conversation_id, role="assistant", parts=parts)
                )
        except Exception:  # saving the failure is best effort
            logger.warning("could not save a failed turn: %s", error)


def _close_dangling(
    history: list[Any], deferred: DeferredToolResults | None
) -> DeferredToolResults | None:
    """
    Every tool call left open in the history (an expired or superseded card) must get a result,
    or the next run can't start. Calls without an explicit decision count as declined.
    """
    answered = {
        part.tool_call_id
        for message in history
        if isinstance(message, ModelRequest)
        for part in message.parts
        if isinstance(part, ToolReturnPart | RetryPromptPart)
    }
    called = [
        part.tool_call_id
        for message in history
        if isinstance(message, ModelResponse)
        for part in message.parts
        if isinstance(part, ToolCallPart)
    ]
    dangling = [call for call in called if call not in answered]
    if not dangling:
        return deferred
    results = deferred or DeferredToolResults()
    for call in dangling:
        results.approvals.setdefault(call, ToolDenied(SUPERSEDED))
    return results


def _say(turn: _Turn, text: str) -> list[str]:
    """A short text part from the service itself (not the model), streamed like any other."""
    part_id = f"{turn.message_id}-t{len(turn.texts)}"
    turn.texts.append(text)
    return [stream.text_start(part_id), stream.text_delta(part_id, text), stream.text_end(part_id)]


def _summary(conversation: Conversation) -> ConversationSummary:
    return ConversationSummary(
        id=conversation.id,
        title=conversation.title or "Новый диалог",
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


async def _conversation(uow: UnitOfWork, actor: CurrentUser, conversation_id: UUID) -> Conversation:
    conversation = await uow.assistant.conversation(conversation_id, actor.id)
    if conversation is None:
        raise ConversationNotFoundError()
    return conversation


async def _actions_of(uow: UnitOfWork, conversation_id: UUID, messages: Any) -> list[PendingAction]:
    ids = [
        UUID(part["data"]["id"])
        for m in messages
        for part in m.parts
        if part.get("type") == "data-action"
    ]
    actions = []
    for action_id in ids:
        action = await uow.session.get(PendingAction, action_id)
        if action is not None and action.conversation_id == conversation_id:
            actions.append(action)
    return actions


def _action_data(action: PendingAction) -> dict[str, Any]:
    return {
        "id": str(action.id),
        "tool": action.tool_name,
        "status": action.status.value,
        "card": action.card,
        "expires_at": action.expires_at.isoformat(),
    }


def _refresh_action(part: dict[str, Any], actions: Mapping[str, PendingAction]) -> dict[str, Any]:
    if part.get("type") != "data-action":
        return part
    action = actions.get(part["data"]["id"])
    return {**part, "data": _action_data(action)} if action else part


def _ui_parts(turn: _Turn) -> list[dict[str, Any]]:
    texts = [{"type": "text", "text": text} for text in turn.texts if text.strip()]
    return texts + turn.parts


def _public_output(content: Any) -> Any:
    """Tool output for the client: the human message and small facts, never internal args."""
    if isinstance(content, dict):
        return {
            k: v
            for k, v in content.items()
            if k in {"message", "found", "outcome", "error", "status"}
        }
    return {"message": str(content)[:500]}
