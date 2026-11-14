import logging
from datetime import UTC, datetime
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.core.errors import DomainError, ErrorCode

logger = logging.getLogger(__name__)

PROBLEM_MEDIA_TYPE = "application/problem+json"


def problem_response(
    request: Request,
    *,
    status: int,
    detail: str,
    error_code: ErrorCode,
    details: Any = None,
    headers: list[tuple[str, str]] | None = None,
) -> JSONResponse:
    """RFC 7807 body plus `error_code` and `request_id`: one error shape for the whole API."""
    body: dict[str, Any] = {
        "type": "about:blank",
        "title": HTTPStatus(status).phrase,
        "status": status,
        "detail": detail,
        "error_code": error_code,
        "instance": request.url.path,
        "timestamp": datetime.now(UTC).isoformat(),
        "request_id": request.scope.get("state", {}).get("request_id"),
    }
    if details is not None:
        body["details"] = jsonable_encoder(details)

    response = JSONResponse(body, status_code=status, media_type=PROBLEM_MEDIA_TYPE)
    for name, value in headers or []:
        response.headers.append(name, value)
    return response


def register_exception_handlers(app: FastAPI, *, debug: bool) -> None:
    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError) -> JSONResponse:
        return problem_response(
            request,
            status=exc.status_code,
            detail=exc.detail,
            error_code=exc.error_code,
            details=exc.details,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return problem_response(
            request,
            status=422,
            detail="Request validation failed",
            error_code=ErrorCode.REQUEST_VALIDATION_ERROR,
            details=exc.errors(),
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        return problem_response(
            request,
            status=exc.status_code,
            detail=exc.detail
            if isinstance(exc.detail, str)
            else HTTPStatus(exc.status_code).phrase,
            error_code=ErrorCode.HTTP_ERROR,
            headers=list((exc.headers or {}).items()),
        )

    @app.exception_handler(Exception)
    async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error on %s %s", request.method, request.url.path)
        return problem_response(
            request,
            status=500,
            detail=f"{type(exc).__name__}: {exc}" if debug else "Internal server error",
            error_code=ErrorCode.INTERNAL_ERROR,
        )
