from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import PlanServiceDep, require
from app.api.schemas.plan import PlanItemOut, QuizIn, QuizOut, TransitionIn
from app.core.clock import today
from app.domain.users import CurrentUser, Permission

router = APIRouter(prefix="/plan", tags=["Plan"])

PlanOwner = Annotated[CurrentUser, Depends(require(Permission.PLAN_OWN))]


@router.get(path="/items/{item_id}", summary="One step of my plan")
async def get_item(item_id: UUID, user: PlanOwner, svc: PlanServiceDep) -> PlanItemOut:
    return PlanItemOut.from_domain(await svc.item(user, item_id), today())


@router.post(
    path="/items/{item_id}/transitions",
    summary="Change the status of my step (start, complete, submit_review, block, unblock)",
    responses={409: {"description": "Transition not allowed or needs a quiz / mentor review"}},
)
async def transition(
    item_id: UUID, payload: TransitionIn, user: PlanOwner, svc: PlanServiceDep
) -> PlanItemOut:
    view = await svc.transition(user, item_id, payload.transition, comment=payload.comment)
    return PlanItemOut.from_domain(view, today())


@router.post(path="/items/{item_id}/quiz", summary="Answer the step's quiz; passing completes it")
async def quiz(item_id: UUID, payload: QuizIn, user: PlanOwner, svc: PlanServiceDep) -> QuizOut:
    result, view = await svc.submit_quiz(user, item_id, payload.answers)
    return QuizOut.build(result, view, today())
