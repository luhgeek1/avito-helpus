from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis

from app.api.middleware import RequestContextMiddleware
from app.api.problems import register_exception_handlers
from app.api.router import api_router
from app.core.clock import today
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from app.core.security.tokens import TokenCodec
from app.db.database import Database
from app.domain.common import UNSET, Unset
from app.infra.corp_mcp import McpCorpServices
from app.infra.llm import embeddings as build_embeddings
from app.service.assistant.agent import build_agent, build_model
from app.service.assistant.chat import ChatRuntime
from app.service.assistant.offline import build_offline_model
from app.service.ports import CorpServices, Embeddings


def create_app(
    settings: Settings | None = None,
    *,
    corp: CorpServices | None = None,
    embeddings: Embeddings | Unset | None = UNSET,
    offline_only: bool = False,
) -> FastAPI:
    """
    App factory: `uvicorn app.main:create_app --factory`.
    Tests call it with their own settings and fakes; nothing is created at import time.
    """
    settings = settings or get_settings()
    configure_logging(settings.log_level, as_json=settings.log_json)
    corp_services: CorpServices = corp or McpCorpServices(
        settings.corp_mcp_url, timeout_sec=settings.corp_timeout_sec
    )
    vector_embeddings = build_embeddings(settings) if isinstance(embeddings, Unset) else embeddings
    online = settings.llm_online and not offline_only

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.db = Database(settings)
        app.state.redis = Redis.from_url(settings.redis_url, decode_responses=True)
        model = build_model(settings, today) if online else build_offline_model(today)
        app.state.chat = ChatRuntime(
            agent=build_agent(),
            model=model,
            db=app.state.db,
            corp=corp_services,
            embeddings=vector_embeddings,
            settings=settings,
            online=online,
            today=today,
        )
        try:
            yield
        finally:
            await app.state.redis.aclose()
            await app.state.db.dispose()

    docs = settings.show_api_docs
    app = FastAPI(
        title="Orbi — AI-buddy API",
        summary="Помощник стажёра: план адаптации, заявки, база знаний, эскалации и агент.",
        version="1.0.0",
        lifespan=lifespan,
        debug=settings.debug,
        docs_url="/api/docs" if docs else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if docs else None,
    )
    app.state.settings = settings
    app.state.token_codec = TokenCodec.from_settings(settings)
    app.state.corp = corp_services
    app.state.embeddings = vector_embeddings

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    # Added last = outermost: every response, including CORS preflights and errors, gets an id.
    app.add_middleware(RequestContextMiddleware)
    register_exception_handlers(app, debug=settings.debug)
    app.include_router(api_router)
    return app
