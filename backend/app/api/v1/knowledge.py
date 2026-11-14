from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import EscalationServiceDep, KnowledgeServiceDep, require
from app.api.schemas.misc import ConflictReportIn, DocumentOut, EscalationOut, SearchOut
from app.core.clock import today
from app.domain.users import CurrentUser, Permission
from app.service.knowledge import viewer_of

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])

Reader = Annotated[CurrentUser, Depends(require(Permission.KNOWLEDGE_READ))]


@router.get(path="/search", summary="Hybrid search over documents I may read, with conflicts")
async def search(
    user: Reader,
    svc: KnowledgeServiceDep,
    q: Annotated[str, Query(min_length=2, max_length=300)],
    limit: Annotated[int, Query(ge=1, le=10)] = 5,
) -> SearchOut:
    result = await svc.search(viewer_of(user), q, limit=limit, user_id=user.id)
    return SearchOut.from_domain(result, today())


@router.get(path="/documents/{slug}", summary="A document I may read")
async def document(slug: str, user: Reader, svc: KnowledgeServiceDep) -> DocumentOut:
    return DocumentOut.from_domain(await svc.document(viewer_of(user), slug))


@router.post(
    path="/conflicts/{conflict_id}/report",
    status_code=status.HTTP_201_CREATED,
    summary="Ask my mentor which of two conflicting instructions is right",
)
async def report_conflict(
    conflict_id: UUID,
    payload: ConflictReportIn,
    user: Annotated[CurrentUser, Depends(require(Permission.ESCALATIONS_CREATE))],
    escalations: EscalationServiceDep,
) -> EscalationOut:
    return EscalationOut.from_domain(
        await escalations.report_conflict(user, conflict_id, note=payload.note)
    )
