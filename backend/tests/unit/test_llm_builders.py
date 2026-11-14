from collections.abc import Callable

from pydantic import SecretStr
from pydantic_ai import ModelMessage, ModelResponse
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.function import AgentInfo, FunctionModel
from pydantic_ai.models.openai import OpenAIChatModel, OpenAIResponsesModel

from app.core.clock import today
from app.core.config import Settings
from app.infra.llm import LlmTextGenerator, OpenAIEmbeddings, chat_model, embeddings, text_generator
from app.service.assistant.agent import build_model


def test_offline_without_a_key(make_settings: Callable[..., Settings]) -> None:
    settings = make_settings()

    assert chat_model(settings) is None
    assert embeddings(settings) is None
    assert text_generator(settings) is None
    assert isinstance(build_model(settings, today), FunctionModel)


def test_openai_uses_the_responses_api(make_settings: Callable[..., Settings]) -> None:
    settings = make_settings(llm_mode="auto", llm_api_key=SecretStr("sk-test"))

    assert isinstance(chat_model(settings), OpenAIResponsesModel)
    assert isinstance(build_model(settings, today), FallbackModel)
    assert isinstance(embeddings(settings), OpenAIEmbeddings)
    assert isinstance(text_generator(settings), LlmTextGenerator)


def test_compatible_gateways_use_chat_completions(make_settings: Callable[..., Settings]) -> None:
    settings = make_settings(
        llm_mode="online", llm_base_url="http://ollama:11434/v1", llm_model="qwen3:8b"
    )

    model = chat_model(settings)
    assert isinstance(model, OpenAIChatModel)
    assert model.model_name == "qwen3:8b"


async def test_background_generation_never_raises(make_settings: Callable[..., Settings]) -> None:
    def broken(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        raise RuntimeError("model is down")

    generator = LlmTextGenerator(FunctionModel(broken), timeout_sec=1)
    assert await generator.generate("instructions", "prompt") is None
