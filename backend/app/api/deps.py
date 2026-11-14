from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import timedelta
from typing import Annotated, Literal

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis

from app.core.config import Settings
from app.core.errors import ForbiddenError, RateLimitedError, UnauthorizedError
from app.core.security.tokens import TokenCodec
from app.db.database import Database
from app.db.uow import UnitOfWork
from app.domain.auth import ClientKind
from app.domain.users import CurrentUser, Permission
from app.infra.rate_limit import RateLimiter
from app.service.assistant.chat import ChatRuntime, ChatService
from app.service.auth import AuthService, resolve_current_user
from app.service.escalations import EscalationService
from app.service.knowledge import KnowledgeService
from app.service.mentor import MentorService
from app.service.ops import AnalyticsService, FlagService
from app.service.people import PeopleService
from app.service.plan import PlanService
from app.service.ports import CorpServices, Embeddings
from app.service.requests import RequestService

# Everything long-lived is created once in the app factory and read from app.state here,
# so tests can build an app with their own settings and fakes.


def _settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def _database(request: Request) -> Database:
    database: Database = request.app.state.db
    return database


def _redis(request: Request) -> Redis:
    redis: Redis = request.app.state.redis
    return redis


def _codec(request: Request) -> TokenCodec:
    codec: TokenCodec = request.app.state.token_codec
    return codec


def _corp(request: Request) -> CorpServices:
    corp: CorpServices = request.app.state.corp
    return corp


def _embeddings(request: Request) -> Embeddings | None:
    embeddings: Embeddings | None = request.app.state.embeddings
    return embeddings


def _chat_runtime(request: Request) -> ChatRuntime:
    runtime: ChatRuntime = request.app.state.chat
    return runtime


SettingsDep = Annotated[Settings, Depends(_settings)]
DatabaseDep = Annotated[Database, Depends(_database)]
RedisDep = Annotated[Redis, Depends(_redis)]
CodecDep = Annotated[TokenCodec, Depends(_codec)]
CorpDep = Annotated[CorpServices, Depends(_corp)]
EmbeddingsDep = Annotated[Embeddings | None, Depends(_embeddings)]
ChatRuntimeDep = Annotated[ChatRuntime, Depends(_chat_runtime)]


async def _unit_of_work(db: DatabaseDep) -> AsyncIterator[UnitOfWork]:
    async with db.unit_of_work() as uow:
        yield uow


# scope="function": the commit runs before the response is sent, so a failed commit
# becomes a 500 instead of a 200 for data that was never saved.
UowDep = Annotated[UnitOfWork, Depends(_unit_of_work, scope="function")]

_bearer = HTTPBearer(auto_error=False, description="Access token from /auth/login or /auth/refresh")


async def current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    codec: CodecDep,
    uow: UowDep,
) -> CurrentUser:
    if creds is None:
        raise UnauthorizedError()
    return await resolve_current_user(uow, codec.decode_access(creds.credentials))


CurrentUserDep = Annotated[CurrentUser, Depends(current_user)]


def require(permission: Permission) -> Callable[[CurrentUser], Awaitable[CurrentUser]]:
    async def dependency(user: CurrentUserDep) -> CurrentUser:
        if not user.can(permission):
            raise ForbiddenError()
        return user

    return dependency


def rate_limit(bucket: str) -> Callable[[Request, RedisDep, SettingsDep], Awaitable[None]]:
    """Per client IP. Behind a proxy run uvicorn with --proxy-headers so the IP is the real one."""

    async def dependency(request: Request, redis: RedisDep, settings: SettingsDep) -> None:
        if not settings.rate_limit_enabled:
            return
        limiter = RateLimiter(redis, limit=settings.auth_rate_limit_per_minute, window_sec=60)
        client = request.client.host if request.client else "unknown"
        if not await limiter.hit(f"{bucket}:{client}"):
            raise RateLimitedError()

    return dependency


async def chat_rate_limit(user: CurrentUserDep, redis: RedisDep, settings: SettingsDep) -> None:
    """Per user: LLM calls cost money and a loop in a client must not drain the budget."""
    if not settings.rate_limit_enabled:
        return
    limiter = RateLimiter(redis, limit=settings.chat_rate_limit_per_minute, window_sec=60)
    if not await limiter.hit(f"chat:{user.id}"):
        raise RateLimitedError()


def _client_kind(
    x_client: Annotated[Literal["web", "mobile"], Header(alias="X-Client")] = "web",
) -> ClientKind:
    return ClientKind(x_client)


ClientDep = Annotated[ClientKind, Depends(_client_kind)]
UserAgentDep = Annotated[str | None, Header(alias="User-Agent", include_in_schema=False)]


def _auth_service(uow: UowDep, codec: CodecDep, settings: SettingsDep) -> AuthService:
    return AuthService(uow, codec, refresh_ttl=timedelta(seconds=settings.refresh_ttl))


def _requests(uow: UowDep, corp: CorpDep, settings: SettingsDep) -> RequestService:
    return RequestService(uow, corp, access_sla_hours=settings.access_sla_hours)


def _escalations(uow: UowDep, settings: SettingsDep) -> EscalationService:
    return EscalationService(uow, sla_hours=settings.escalation_sla_hours)


def _knowledge(uow: UowDep, embeddings: EmbeddingsDep) -> KnowledgeService:
    return KnowledgeService(uow, embeddings)


def _people(uow: UowDep) -> PeopleService:
    return PeopleService(uow)


def _plan(uow: UowDep) -> PlanService:
    return PlanService(uow)


def _mentor(uow: UowDep) -> MentorService:
    return MentorService(uow)


def _flags(uow: UowDep) -> FlagService:
    return FlagService(uow)


def _analytics(uow: UowDep) -> AnalyticsService:
    return AnalyticsService(uow)


def _chat(runtime: ChatRuntimeDep) -> ChatService:
    return ChatService(runtime)


AuthServiceDep = Annotated[AuthService, Depends(_auth_service)]
PeopleServiceDep = Annotated[PeopleService, Depends(_people)]
PlanServiceDep = Annotated[PlanService, Depends(_plan)]
MentorServiceDep = Annotated[MentorService, Depends(_mentor)]
FlagServiceDep = Annotated[FlagService, Depends(_flags)]
AnalyticsServiceDep = Annotated[AnalyticsService, Depends(_analytics)]
RequestServiceDep = Annotated[RequestService, Depends(_requests)]
EscalationServiceDep = Annotated[EscalationService, Depends(_escalations)]
KnowledgeServiceDep = Annotated[KnowledgeService, Depends(_knowledge)]
ChatServiceDep = Annotated[ChatService, Depends(_chat)]
