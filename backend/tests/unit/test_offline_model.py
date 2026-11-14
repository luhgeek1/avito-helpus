from datetime import date

import pytest
from pydantic_ai import (
    Agent,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models.function import AgentInfo
from pydantic_ai.tools import ToolDefinition

from app.service.assistant.deps import TOOL_PERMISSIONS
from app.service.assistant.offline import build_offline_model, respond, route

TODAY = date(2026, 11, 13)
INTERN_TOOLS = {
    name
    for name in TOOL_PERMISSIONS
    if name not in {"list_mentees", "open_questions", "answer_question"}
}
ALL_TOOLS = set(TOOL_PERMISSIONS)


@pytest.mark.parametrize(
    ("prompt", "tool", "args"),
    [
        (
            "Нужен доступ к репозиторию listings-api",
            "request_access",
            {"resource": "репозиторию listings-api"},
        ),
        ("дай доступ на запись к jira", "request_access", {"resource": "jira", "level": "write"}),
        (
            "хочу отгул 20.11",
            "request_absence",
            {
                "absence_type": "day_off",
                "start_date": "2026-11-20",
                "end_date": "2026-11-20",
                "comment": "",
            },
        ),
        ("Когда выдадут ноутбук?", "equipment_status", {}),
        ("Что мне делать дальше?", "get_my_plan", {}),
        ("Какие у меня заявки?", "my_requests", {}),
        ("Кто мой наставник?", "who_is_who", {}),
        (
            "Хочу обсудить конфликт с руководителем",
            "ask_mentor",
            {"question": "Хочу обсудить конфликт с руководителем", "kind": "sensitive"},
        ),
        (
            "Спроси у наставника: как выкатить ветку",
            "ask_mentor",
            {"question": "как выкатить ветку"},
        ),
        (
            "я застрял с миграциями",
            "ask_mentor",
            {"question": "я застрял с миграциями", "kind": "blocker"},
        ),
        (
            "Отметь сделал знакомство с командой",
            "update_plan_step",
            {"step": "знакомство с командой", "action": "complete"},
        ),
        (
            "Начинаю курс микросервисов",
            "update_plan_step",
            {"step": "курс микросервисов", "action": "start"},
        ),
        (
            "Напиши команде: завтра меня не будет",
            "post_team_message",
            {"text": "завтра меня не будет"},
        ),
        ("Куда отправить PR?", "search_knowledge", {"query": "Куда отправить PR?"}),
        (
            "у меня сломался ноутбук",
            "create_it_ticket",
            {"category": "Техника", "description": "у меня сломался ноутбук"},
        ),
    ],
)
def test_intern_intents(prompt: str, tool: str, args: dict[str, object]) -> None:
    intent = route(prompt, INTERN_TOOLS, TODAY)

    assert intent.tool == tool
    assert intent.args == args


def test_mentor_intents_need_mentor_tools() -> None:
    assert route("Как дела у моих подопечных?", ALL_TOOLS, TODAY).tool == "list_mentees"
    assert route("Покажи открытые вопросы от стажёров", ALL_TOOLS, TODAY).tool == "open_questions"
    assert route("Как дела у моих подопечных?", INTERN_TOOLS, TODAY).tool == "search_knowledge"


def test_text_answers() -> None:
    assert "Орби" in (route("Привет!", INTERN_TOOLS, TODAY).text or "")
    assert route("спасибо", INTERN_TOOLS, TODAY).text
    assert "даты" in (route("хочу отпуск", INTERN_TOOLS, TODAY).text or "")
    assert route("что-нибудь", set(), TODAY).text


def test_colleague_pay_is_refused_without_handoff() -> None:
    intent = route("Сколько получает Иван?", INTERN_TOOLS, TODAY)

    assert intent.tool is None
    assert "не передаю" in (intent.text or "")


def _info(tools: set[str]) -> AgentInfo:
    return AgentInfo(
        function_tools=[ToolDefinition(name=t) for t in sorted(tools)],
        allow_text_output=True,
        output_tools=[],
        model_settings=None,
        model_request_parameters=None,  # type: ignore[arg-type]
        instructions=None,
    )


def test_summarizes_tool_results_and_offers_the_mentor_once() -> None:
    question = ModelRequest(parts=[UserPromptPart("Как оформить командировку?")])
    call = ModelResponse(parts=[ToolCallPart("search_knowledge", {"query": "x"}, tool_call_id="1")])
    nothing = ModelRequest(
        parts=[
            ToolReturnPart("search_knowledge", {"found": False, "message": "нет"}, tool_call_id="1")
        ]
    )

    follow_up = respond([question, call, nothing], _info(INTERN_TOOLS), today_fn=lambda: TODAY)
    assert isinstance(follow_up.parts[0], ToolCallPart)
    assert follow_up.parts[0].tool_name == "ask_mentor"

    asked = ModelResponse(parts=[ToolCallPart("ask_mentor", {"question": "x"}, tool_call_id="2")])
    done = ModelRequest(
        parts=[ToolReturnPart("ask_mentor", {"message": "Передал вопрос"}, tool_call_id="2")]
    )
    final = respond(
        [question, call, nothing, asked, done], _info(INTERN_TOOLS), today_fn=lambda: TODAY
    )
    assert isinstance(final.parts[0], TextPart)
    assert final.parts[0].content == "Передал вопрос"


def test_denied_card_and_new_message() -> None:
    denied = ModelRequest(
        parts=[ToolReturnPart("request_access", "Пользователь отклонил действие", tool_call_id="1")]
    )
    reply = respond([denied], _info(INTERN_TOOLS), today_fn=lambda: TODAY)
    assert reply.parts[0].content == "Хорошо, ничего не отправляю."  # type: ignore[union-attr]

    with_prompt = ModelRequest(parts=[*denied.parts, UserPromptPart("Кто мой наставник?")])
    reply = respond([with_prompt], _info(INTERN_TOOLS), today_fn=lambda: TODAY)
    assert reply.parts[0].tool_name == "who_is_who"  # type: ignore[union-attr]


async def test_streaming_function_yields_text_in_chunks() -> None:
    agent = Agent(build_offline_model(lambda: TODAY))
    async with agent.run_stream("Привет") as result:
        chunks = [chunk async for chunk in result.stream_text(delta=True, debounce_by=None)]

    assert len(chunks) > 1
    assert "".join(chunks).startswith("Привет! Я Орби")
