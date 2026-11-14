from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse

from app.api.deps import ChatRuntimeDep, ChatServiceDep, chat_rate_limit, require
from app.api.schemas.misc import (
    AssistantStatusOut,
    ChatMessageOut,
    ConversationOut,
    DecisionIn,
    FeedbackIn,
    HistoryOut,
    MessageIn,
)
from app.domain.users import CurrentUser, Permission
from app.service.assistant.stream import STREAM_HEADERS

router = APIRouter(tags=["Assistant"])

Chatter = Annotated[CurrentUser, Depends(require(Permission.ASSISTANT_USE))]

_SSE_DOC: dict[int | str, dict[str, Any]] = {
    200: {
        "description": (
            "Server-Sent Events in the Vercel AI SDK UI message stream format (v1): start, "
            "text-start/text-delta/text-end, tool-input-available, tool-output-available, "
            "data-status (transient), data-sources, data-request, data-action (confirmation card), "
            "data-escalation, data-plan, data-equipment, error, finish, then `data: [DONE]`."
        ),
        "content": {"text/event-stream": {}},
    }
}


@router.get(path="/assistant/status", summary="Online (LLM) or offline mode, model name")
async def assistant_status(_: Chatter, runtime: ChatRuntimeDep) -> AssistantStatusOut:
    return AssistantStatusOut(
        mode=runtime.mode.value,
        model=runtime.settings.llm_model if runtime.online else None,
        embeddings=runtime.embeddings is not None,
    )


@router.get(path="/chat/conversations", summary="My conversations with Orbi")
async def conversations(user: Chatter, svc: ChatServiceDep) -> list[ConversationOut]:
    return [ConversationOut.from_domain(c) for c in await svc.conversations(user)]


@router.post(
    path="/chat/conversations", status_code=status.HTTP_201_CREATED, summary="Start a conversation"
)
async def create_conversation(user: Chatter, svc: ChatServiceDep) -> ConversationOut:
    return ConversationOut.from_domain(await svc.create(user))


@router.get(path="/chat/conversations/{conversation_id}", summary="Conversation history (UI parts)")
async def history(conversation_id: UUID, user: Chatter, svc: ChatServiceDep) -> HistoryOut:
    conversation, messages = await svc.history(user, conversation_id)
    return HistoryOut(
        conversation=ConversationOut.from_domain(conversation),
        messages=[ChatMessageOut.from_domain(m) for m in messages],
    )


@router.post(
    path="/chat/conversations/{conversation_id}/messages",
    summary="Send a message; the answer streams back as SSE",
    responses=_SSE_DOC,
    response_class=StreamingResponse,
    dependencies=[Depends(chat_rate_limit)],
)
async def send_message(
    conversation_id: UUID, payload: MessageIn, user: Chatter, svc: ChatServiceDep
) -> StreamingResponse:
    deferred = await svc.prepare_message(user, conversation_id, payload.text)
    return StreamingResponse(
        svc.stream_turn(user, conversation_id, prompt=payload.text, deferred=deferred),
        media_type="text/event-stream",
        headers=STREAM_HEADERS,
    )


@router.post(
    path="/chat/conversations/{conversation_id}/actions/{action_id}",
    summary="Approve (optionally with edits) or reject a confirmation card; the run resumes as SSE",
    responses={**_SSE_DOC, 409: {"description": "Already decided or expired"}},
    response_class=StreamingResponse,
    dependencies=[Depends(chat_rate_limit)],
)
async def decide(
    conversation_id: UUID,
    action_id: UUID,
    payload: DecisionIn,
    user: Chatter,
    svc: ChatServiceDep,
) -> StreamingResponse:
    deferred = await svc.prepare_decision(
        user, conversation_id, action_id, decision=payload.decision, edits=payload.edits
    )
    return StreamingResponse(
        svc.stream_turn(user, conversation_id, prompt=None, deferred=deferred),
        media_type="text/event-stream",
        headers=STREAM_HEADERS,
    )


@router.post(
    path="/chat/messages/{message_id}/feedback",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Rate an answer (👍/👎) for quality metrics",
)
async def feedback(
    message_id: UUID, payload: FeedbackIn, user: Chatter, svc: ChatServiceDep
) -> None:
    await svc.feedback(user, message_id, rating=payload.rating, comment=payload.comment)
