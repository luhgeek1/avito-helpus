from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status

from app.api.deps import AnalyticsServiceDep, CurrentUserDep, DatabaseDep, FlagServiceDep, require
from app.api.schemas.misc import AuditOut, FlagOut, FlagUpdateIn, MetricsOut, UiEventIn
from app.domain.users import CurrentUser, Permission
from app.seed.loader import seed

router = APIRouter(tags=["Analytics & admin"])


@router.get(
    path="/analytics/summary", summary="Product metrics for the A/B check (lead, HRBP, admin)"
)
async def summary(
    _: Annotated[CurrentUser, Depends(require(Permission.ANALYTICS_READ))],
    svc: AnalyticsServiceDep,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> MetricsOut:
    return MetricsOut.from_domain(await svc.summary(days=days))


@router.post(
    path="/analytics/events", status_code=status.HTTP_204_NO_CONTENT, summary="Track a UI event"
)
async def ui_event(payload: UiEventIn, user: CurrentUserDep, svc: AnalyticsServiceDep) -> None:
    svc.track_ui(user, payload.name, dict(payload.properties))


@router.get(path="/admin/flags", summary="Feature flags and experiments")
async def flags(
    _: Annotated[CurrentUser, Depends(require(Permission.FLAGS_MANAGE))], svc: FlagServiceDep
) -> list[FlagOut]:
    return [FlagOut.model_validate(f) for f in await svc.all()]


@router.put(path="/admin/flags/{key}", summary="Change a flag (audited)")
async def update_flag(
    key: str,
    payload: FlagUpdateIn,
    user: Annotated[CurrentUser, Depends(require(Permission.FLAGS_MANAGE))],
    svc: FlagServiceDep,
) -> FlagOut:
    state = await svc.update(
        user,
        key,
        enabled=payload.enabled,
        rollout_percent=payload.rollout_percent,
        variants=payload.variants,
    )
    return FlagOut.model_validate(state)


@router.get(
    path="/admin/audit", summary="Audit log: confirmations, requests, answers, flag changes"
)
async def audit(
    _: Annotated[CurrentUser, Depends(require(Permission.AUDIT_READ))],
    svc: AnalyticsServiceDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[AuditOut]:
    return [AuditOut.model_validate(row) for row in await svc.audit(limit=limit)]


@router.post(
    path="/admin/demo/reset",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Reset the demo company to its initial state (admin only)",
)
async def reset_demo(
    _: Annotated[CurrentUser, Depends(require(Permission.DEMO_RESET))],
    db: DatabaseDep,
    background: BackgroundTasks,
) -> dict[str, str]:
    # After the response: this request's own transaction must be closed before TRUNCATE can run.
    background.add_task(seed, db, reset=True)
    return {"status": "reset scheduled"}
