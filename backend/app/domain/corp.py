from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum

from app.core.errors import ConflictError, ErrorCode, ServiceUnavailableError


class CorpTicketStatus(StrEnum):
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class EquipmentStatus(StrEnum):
    ORDERED = "ordered"
    IN_TRANSIT = "in_transit"
    READY_FOR_PICKUP = "ready_for_pickup"
    ISSUED = "issued"
    DELAYED = "delayed"


EQUIPMENT_STATUS_TITLES = {
    EquipmentStatus.ORDERED: "заказан",
    EquipmentStatus.IN_TRANSIT: "в пути",
    EquipmentStatus.READY_FOR_PICKUP: "готов к выдаче",
    EquipmentStatus.ISSUED: "выдан",
    EquipmentStatus.DELAYED: "задерживается",
}


@dataclass(frozen=True, slots=True)
class CorpTicket:
    """What a corporate service answers about a request it owns."""

    external_id: str
    status: CorpTicketStatus
    comment: str | None = None
    sla_hours: float | None = None
    approver: str | None = None


@dataclass(frozen=True, slots=True)
class AccessGrant:
    has_access: bool
    level: str | None = None
    granted_at: date | None = None


@dataclass(frozen=True, slots=True)
class EquipmentItem:
    kind: str
    model: str
    status: EquipmentStatus
    eta: date | None
    pickup_location: str | None
    pickup_hours: str | None
    note: str | None = None

    @property
    def status_title(self) -> str:
        return EQUIPMENT_STATUS_TITLES[self.status]


@dataclass(frozen=True, slots=True)
class CorpEvent:
    title: str
    starts_at: datetime
    important: bool


class CorpUnavailableError(ServiceUnavailableError):
    """Timeout, connection failure or a 5xx-like fault: safe to retry with the same key."""


class CorpRequestError(ConflictError):
    """The service understood the request and refused it: retrying will not help."""

    error_code = ErrorCode.CONFLICT
    default_detail = "The corporate service rejected the request"
