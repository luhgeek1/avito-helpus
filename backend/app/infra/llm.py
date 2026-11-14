import asyncio
import logging
from collections.abc import Sequence

from pydantic_ai import Agent, Embedder
from pydantic_ai.embeddings.openai import OpenAIEmbeddingModel
from pydantic_ai.embeddings.settings import EmbeddingSettings
from pydantic_ai.models import Model
from pydantic_ai.models.openai import (
    OpenAIChatModel,
    OpenAIChatModelSettings,
    OpenAIResponsesModel,
    OpenAIResponsesModelSettings,
)
from pydantic_ai.providers.openai import OpenAIProvider

from app.core.config import Settings
from app.db.models import EMBEDDING_DIM

logger = logging.getLogger(__name__)


def _provider(settings: Settings) -> OpenAIProvider:
    key = settings.llm_api_key.get_secret_value() if settings.llm_api_key else None
    return OpenAIProvider(base_url=settings.llm_base_url, api_key=key or "not-needed")


def chat_model(settings: Settings, *, heavy: bool = False) -> Model | None:
    """
    The online model, or None in offline mode (no key, or LLM_MODE=offline).
    OpenAI's GPT-5 family takes reasoning settings with tools only on the Responses API, so that
    API is used for OpenAI itself; OpenAI-compatible gateways get plain Chat Completions.
    """
    if not settings.llm_online:
        return None
    name = settings.llm_heavy_model if heavy else settings.llm_model
    use_responses = settings.llm_api == "responses" or (
        settings.llm_api == "auto" and settings.llm_base_url is None
    )
    if use_responses:
        return OpenAIResponsesModel(
            name,
            provider=_provider(settings),
            settings=OpenAIResponsesModelSettings(
                timeout=settings.llm_timeout_sec,
                openai_reasoning_effort="low" if heavy else settings.llm_reasoning_effort,
                max_retries=1,
            ),
        )
    return OpenAIChatModel(
        name,
        provider=_provider(settings),
        settings=OpenAIChatModelSettings(timeout=settings.llm_timeout_sec, max_retries=1),
    )


class OpenAIEmbeddings:
    """`Embeddings` port over the OpenAI embeddings API (any compatible endpoint)."""

    def __init__(self, settings: Settings) -> None:
        self._embedder = Embedder(
            OpenAIEmbeddingModel(settings.embeddings_model, provider=_provider(settings)),
            settings=EmbeddingSettings(dimensions=EMBEDDING_DIM),
        )

    async def embed_query(self, text: str) -> Sequence[float]:
        result = await self._embedder.embed_query(text)
        return list(result.embeddings[0])

    async def embed_documents(self, texts: Sequence[str]) -> list[Sequence[float]]:
        result = await self._embedder.embed_documents(list(texts))
        return [list(vector) for vector in result.embeddings]


def embeddings(settings: Settings) -> OpenAIEmbeddings | None:
    if not (settings.llm_online and settings.embeddings_enabled):
        return None
    return OpenAIEmbeddings(settings)


class LlmTextGenerator:
    """`TextGenerator` for background jobs; returns None instead of raising, jobs fall back."""

    def __init__(self, model: Model, *, timeout_sec: float) -> None:
        self._model = model
        self._timeout = timeout_sec

    async def generate(self, instructions: str, prompt: str) -> str | None:
        agent = Agent(self._model, instructions=instructions)
        try:
            async with asyncio.timeout(self._timeout):
                result = await agent.run(prompt)
        except Exception:  # background generation is optional; the caller has a template
            logger.warning("background generation failed", exc_info=True)
            return None
        return result.output.strip() or None


def text_generator(settings: Settings) -> LlmTextGenerator | None:
    model = chat_model(settings, heavy=True)
    return LlmTextGenerator(model, timeout_sec=settings.llm_timeout_sec * 2) if model else None
