from enum import StrEnum
from typing import Any, ClassVar


class ErrorCode(StrEnum):
    """Closed list of machine-readable codes. Clients switch on these, never on `detail` text."""

    BAD_REQUEST = "BAD_REQUEST"
    REQUEST_VALIDATION_ERROR = "REQUEST_VALIDATION_ERROR"
    INVALID_CURSOR = "INVALID_CURSOR"

    NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
    INVALID_TOKEN = "INVALID_TOKEN"  # noqa: S105
    TOKEN_EXPIRED = "TOKEN_EXPIRED"  # noqa: S105
    WRONG_CREDENTIALS = "WRONG_CREDENTIALS"
    SESSION_REVOKED = "SESSION_REVOKED"
    REFRESH_TOKEN_REUSED = "REFRESH_TOKEN_REUSED"  # noqa: S105
    CSRF_FAILED = "CSRF_FAILED"
    WEBHOOK_SIGNATURE_INVALID = "WEBHOOK_SIGNATURE_INVALID"

    FORBIDDEN = "FORBIDDEN"
    ACCOUNT_BANNED = "ACCOUNT_BANNED"

    NOT_FOUND = "NOT_FOUND"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    PLAN_ITEM_NOT_FOUND = "PLAN_ITEM_NOT_FOUND"
    REQUEST_NOT_FOUND = "REQUEST_NOT_FOUND"
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    DOCUMENT_NOT_FOUND = "DOCUMENT_NOT_FOUND"
    CONFLICT_NOT_FOUND = "CONFLICT_NOT_FOUND"
    ESCALATION_NOT_FOUND = "ESCALATION_NOT_FOUND"
    CONVERSATION_NOT_FOUND = "CONVERSATION_NOT_FOUND"
    ACTION_NOT_FOUND = "ACTION_NOT_FOUND"
    NOTIFICATION_NOT_FOUND = "NOTIFICATION_NOT_FOUND"
    MENTEE_NOT_FOUND = "MENTEE_NOT_FOUND"
    FLAG_NOT_FOUND = "FLAG_NOT_FOUND"

    CONFLICT = "CONFLICT"
    PLAN_TRANSITION_INVALID = "PLAN_TRANSITION_INVALID"
    PLAN_QUIZ_REQUIRED = "PLAN_QUIZ_REQUIRED"
    PLAN_REVIEW_REQUIRED = "PLAN_REVIEW_REQUIRED"
    REQUEST_TRANSITION_INVALID = "REQUEST_TRANSITION_INVALID"
    ACCESS_ALREADY_GRANTED = "ACCESS_ALREADY_GRANTED"
    ACCESS_LEVEL_NOT_ALLOWED = "ACCESS_LEVEL_NOT_ALLOWED"
    ABSENCE_INVALID_DATES = "ABSENCE_INVALID_DATES"
    ABSENCE_BALANCE_EXCEEDED = "ABSENCE_BALANCE_EXCEEDED"
    ESCALATION_CLOSED = "ESCALATION_CLOSED"
    ACTION_ALREADY_DECIDED = "ACTION_ALREADY_DECIDED"
    ACTION_EXPIRED = "ACTION_EXPIRED"
    REMIND_TOO_SOON = "REMIND_TOO_SOON"

    CORP_SERVICE_UNAVAILABLE = "CORP_SERVICE_UNAVAILABLE"
    ASSISTANT_UNAVAILABLE = "ASSISTANT_UNAVAILABLE"
    RATE_LIMITED = "RATE_LIMITED"
    HTTP_ERROR = "HTTP_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class DomainError(Exception):
    """
    Base for every expected error. The API layer turns it into an RFC 7807 problem response.

    `keep_changes` marks the rare error that must not roll back the transaction:
    e.g. revoking a session after refresh-token reuse, and still answering 401.
    """

    status_code: ClassVar[int] = 400
    error_code: ClassVar[ErrorCode] = ErrorCode.BAD_REQUEST
    default_detail: ClassVar[str] = "Bad request"
    keep_changes: ClassVar[bool] = False

    def __init__(self, detail: str | None = None, *, details: Any = None) -> None:
        self.detail = detail or self.default_detail
        self.details = details
        self.headers: list[tuple[str, str]] = []
        super().__init__(self.detail)


class UnauthorizedError(DomainError):
    status_code = 401
    error_code = ErrorCode.NOT_AUTHENTICATED
    default_detail = "Authentication required"


class InvalidTokenError(UnauthorizedError):
    error_code = ErrorCode.INVALID_TOKEN
    default_detail = "Token is invalid"


class TokenExpiredError(UnauthorizedError):
    error_code = ErrorCode.TOKEN_EXPIRED
    default_detail = "Token has expired"


class ForbiddenError(DomainError):
    status_code = 403
    error_code = ErrorCode.FORBIDDEN
    default_detail = "You don't have permission to do this"


class NotFoundError(DomainError):
    status_code = 404
    error_code = ErrorCode.NOT_FOUND
    default_detail = "Not found"


class ConflictError(DomainError):
    status_code = 409
    error_code = ErrorCode.CONFLICT
    default_detail = "Conflict"


class RateLimitedError(DomainError):
    status_code = 429
    error_code = ErrorCode.RATE_LIMITED
    default_detail = "Too many requests, try again in a minute"


class ServiceUnavailableError(DomainError):
    status_code = 503
    error_code = ErrorCode.CORP_SERVICE_UNAVAILABLE
    default_detail = "A corporate service is temporarily unavailable"
