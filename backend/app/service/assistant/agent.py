from collections.abc import Callable
from datetime import date

from pydantic_ai import Agent, DeferredToolRequests, RunContext
from pydantic_ai.models import Model
from pydantic_ai.models.fallback import FallbackModel

from app.core.config import Settings
from app.infra.llm import chat_model
from app.service.assistant.deps import AgentDeps
from app.service.assistant.offline import build_offline_model
from app.service.assistant.prompts import BASE_INSTRUCTIONS, context_block
from app.service.assistant.tools import build_toolset

OrbiAgent = Agent[AgentDeps, str | DeferredToolRequests]


def build_agent() -> OrbiAgent:
    """
    One agent for every role: instructions are static plus a per-run context block, tools are
    filtered per run by the caller's permissions. The model is chosen per run (`build_model`).
    """
    agent: OrbiAgent = Agent(
        deps_type=AgentDeps,
        output_type=[str, DeferredToolRequests],
        instructions=BASE_INSTRUCTIONS,
        toolsets=[build_toolset()],
        retries=1,
        name="orbi",
    )

    @agent.instructions
    def user_context(ctx: RunContext[AgentDeps]) -> str:
        return context_block(ctx.deps)

    return agent


def build_model(settings: Settings, today_fn: Callable[[], date]) -> Model:
    """Online model with an automatic fallback to the offline one, or offline only without a key."""
    offline = build_offline_model(today_fn)
    online = chat_model(settings)
    return FallbackModel(online, offline) if online is not None else offline
