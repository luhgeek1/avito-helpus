import asyncio
import logging
from collections.abc import Awaitable
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response

from app.api.deps import DatabaseDep, RedisDep
from app.infra.metrics import render

logger = logging.getLogger(__name__)

router = APIRouter(tags=["System"])

_CHECK_TIMEOUT_SEC = 2.0


@router.get(path="/health", summary="Liveness: the process is up (never touches dependencies)")
async def health() -> dict[str, str]:
    return {"status": "ok"}


async def _check(name: str, probe: Awaitable[Any]) -> tuple[str, bool]:
    try:
        await asyncio.wait_for(probe, timeout=_CHECK_TIMEOUT_SEC)
    except Exception:  # a readiness probe reports any failure instead of raising it
        logger.warning("readiness check %s failed", name, exc_info=True)
        return name, False
    return name, True


@router.get(
    path="/ready",
    summary="Readiness: Postgres and Redis answer",
    responses={503: {"description": "A dependency is down"}},
)
async def ready(db: DatabaseDep, redis: RedisDep) -> JSONResponse:
    results = await asyncio.gather(
        _check("database", db.ping()),
        _check("redis", redis.ping()),
    )
    checks = {name: "ok" if ok else "error" for name, ok in results}
    healthy = all(ok for _, ok in results)
    return JSONResponse(
        {"status": "ready" if healthy else "not_ready", "checks": checks},
        status_code=200 if healthy else 503,
    )


@router.get(path="/metrics", summary="Prometheus metrics", include_in_schema=False)
async def metrics() -> Response:
    body, content_type = render()
    return Response(body, media_type=content_type)
