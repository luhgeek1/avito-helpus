import json
import re
from collections.abc import AsyncIterator, Callable, Sequence
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import uuid4

from pydantic_ai import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models.function import AgentInfo, DeltaToolCall, DeltaToolCalls, FunctionModel

from app.domain.absence import AbsenceType, parse_dates_ru
from app.domain.knowledge import PRIVATE_TOPICS, detect_sensitive

OFFLINE_MODEL_NAME = "orbi-offline"
_CHUNK = 24


@dataclass(frozen=True, slots=True)
class Intent:
    tool: str | None = None
    args: dict[str, Any] = field(default_factory=dict)
    text: str | None = None


def _has(text: str, *patterns: str) -> bool:
    return any(re.search(pattern, text) for pattern in patterns)


def _after(text: str, *markers: str) -> str:
    for marker in markers:
        match = re.search(marker, text)
        if match and text[match.end() :].strip(" .,:?!«»\"'"):
            return text[match.end() :].strip(" .,:?!«»\"'")
    return text.strip()


def _greeting(tools: set[str]) -> str:
    can = []
    if "get_my_plan" in tools:
        can.append("подсказать следующий шаг плана")
    if "request_access" in tools:
        can.append("оформить доступ")
    if "request_absence" in tools:
        can.append("взять отгул")
    if "search_knowledge" in tools:
        can.append("найти ответ в инструкциях")
    if "list_mentees" in tools:
        can.append("показать подопечных и их вопросы")
    return "Привет! Я Орби. Могу " + ", ".join(can) + ". С чего начнём?"


def _intent_mentor(text: str, tools: set[str]) -> Intent | None:
    if "list_mentees" in tools and _has(text, r"подопечн", r"мои стаж", r"как дела у стаж"):
        return Intent("list_mentees")
    if "open_questions" in tools and _has(
        text, r"открыт\w* вопрос", r"вопрос\w* от стаж", r"что спрашива"
    ):
        return Intent("open_questions")
    return None


def _intent_actions(  # noqa: PLR0911 - one return per recognised intent reads best
    text: str, prompt: str, tools: set[str], today: date
) -> Intent | None:
    if "ask_mentor" in tools and _has(
        text,
        r"спроси\w* (у )?наставник",
        r"передай наставник",
        r"вопрос наставник",
        r"спроси\w* (у )?руковод",
    ):
        return Intent(
            "ask_mentor", {"question": _after(prompt, r"(?i)наставник\w*", r"(?i)руководител\w*")}
        )
    if "ask_mentor" in tools and _has(text, r"застрял", r"не могу продвинуться", r"заблокирован"):
        return Intent("ask_mentor", {"question": prompt, "kind": "blocker"})
    if "request_access" in tools and _has(text, r"доступ"):
        level = "write" if _has(text, r"запис", r"редакт", r"write", r"пуш", r"push") else None
        level = "admin" if _has(text, r"админ") else level
        target = re.sub(r"(?i)\s*(на|для)\s+(запись|чтение|редактирование|админ\w*)", "", prompt)
        resource = _after(target, r"(?i)доступ\w*\s+(к|в|на|до)\s+", r"(?i)доступ\w*")
        args: dict[str, Any] = {"resource": resource}
        if level:
            args["level"] = level
        return Intent("request_access", args)
    if "request_absence" in tools and _has(
        text, r"отгул", r"отпуск", r"выходн\w* за свой", r"day ?off"
    ):
        dates = parse_dates_ru(text, today)
        if dates is None:
            return Intent(
                text="На какие даты? Например: «отгул 20.11» или «отпуск с 1 по 5 декабря»."
            )
        kind = AbsenceType.VACATION if "отпуск" in text else AbsenceType.DAY_OFF
        return Intent(
            "request_absence",
            {
                "absence_type": kind.value,
                "start_date": dates[0].isoformat(),
                "end_date": dates[1].isoformat(),
                "comment": "",
            },
        )
    if "create_it_ticket" in tools and _has(
        text, r"обращени\w* в it", r"тикет", r"сломал", r"не работает ноут"
    ):
        return Intent("create_it_ticket", {"category": "Техника", "description": prompt})
    if "equipment_status" in tools and _has(
        text, r"ноут", r"макбук", r"техник", r"laptop", r"монитор"
    ):
        return Intent("equipment_status")
    if "post_team_message" in tools and _has(
        text, r"напиши в канал", r"сообщи команде", r"напиши команде"
    ):
        return Intent(
            "post_team_message", {"text": _after(prompt, r":", r"(?i)команде", r"(?i)канал")}
        )
    return None


def _intent_plan(text: str, prompt: str, tools: set[str]) -> Intent | None:
    if "update_plan_step" in tools and _has(
        text, r"^отметь", r"\bсделал", r"\bвыполнил", r"закрой шаг"
    ):
        step = re.sub(
            r"(?i)\b(отметь|сделал\w*|выполнил\w*|закрой шаг|как выполненн\w*)\b", "", prompt
        ).strip(" .,:!«»")
        return Intent("update_plan_step", {"step": step, "action": "complete"})
    if "update_plan_step" in tools and _has(text, r"начинаю", r"взял\w* в работу", r"приступаю"):
        step = _after(prompt, r"(?i)(начинаю|взял\w* в работу|приступаю к)")
        return Intent("update_plan_step", {"step": step, "action": "start"})
    if "get_my_plan" in tools and _has(
        text,
        r"план",
        r"что (мне )?делать",
        r"следующ\w* шаг",
        r"чек-?лист",
        r"с чего начать",
        r"что дальше",
    ):
        return Intent("get_my_plan")
    if "my_requests" in tools and _has(text, r"заявк", r"статус"):
        return Intent("my_requests")
    if "who_is_who" in tools and _has(
        text,
        r"кто мой",
        r"кто (у меня )?наставник",
        r"кому (писать|обращаться)",
        r"кто руковод",
        r"hrbp",
        r"контакт",
    ):
        return Intent("who_is_who")
    return None


PRIVATE_REFUSAL = (
    "Про зарплаты и личные данные коллег я не рассказываю и такие вопросы никому не передаю. "
    "Про своё вознаграждение можно спросить руководителя или HRBP."
)


def _intent_sensitive(text: str, prompt: str, tools: set[str]) -> Intent | None:
    topic = detect_sensitive(text)
    if topic is None:
        return None
    if topic in PRIVATE_TOPICS:
        return Intent(text=PRIVATE_REFUSAL)
    if "ask_mentor" in tools:
        return Intent("ask_mentor", {"question": prompt, "kind": "sensitive"})
    return None


def route(prompt: str, tools: set[str], today: date) -> Intent:
    """Rule-based intent detection for offline mode: the same tools, no LLM."""
    text = prompt.lower().strip()
    detected = (
        _intent_sensitive(text, prompt, tools)
        or _intent_mentor(text, tools)
        or _intent_actions(text, prompt, tools, today)
        or _intent_plan(text, prompt, tools)
    )
    if detected is not None:
        return detected
    if _has(text, r"^(привет|здравствуй|добрый|хай|hello|hi)\b"):
        return Intent(text=_greeting(tools))
    if _has(text, r"спасибо", r"благодарю"):
        return Intent(text="Обращайся! Если что — я здесь.")
    if "search_knowledge" in tools:
        return Intent("search_knowledge", {"query": prompt})
    return Intent(text="Пока не умею с этим помочь. Попробуй переформулировать.")


def _user_prompt(messages: Sequence[ModelMessage]) -> str:
    for message in reversed(messages):
        if isinstance(message, ModelRequest):
            for part in message.parts:
                if isinstance(part, UserPromptPart) and isinstance(part.content, str):
                    return part.content
    return ""


def _called(messages: Sequence[ModelMessage], tool: str) -> bool:
    return any(
        isinstance(part, ToolCallPart) and part.tool_name == tool
        for message in messages
        if isinstance(message, ModelResponse)
        for part in message.parts
    )


def _tool_call(name: str, args: dict[str, Any]) -> ToolCallPart:
    return ToolCallPart(tool_name=name, args=args, tool_call_id=f"offline-{uuid4().hex[:16]}")


def _summarize(returns: Sequence[ToolReturnPart]) -> str:
    lines = []
    for part in returns:
        content = part.content
        if isinstance(content, dict) and content.get("message"):
            lines.append(str(content["message"]))
        elif isinstance(content, str) and content:
            lines.append("Хорошо, ничего не отправляю." if "отклон" in content.lower() else content)
    return "\n\n".join(lines) or "Готово."


def respond(
    messages: list[ModelMessage], info: AgentInfo, *, today_fn: Callable[[], date]
) -> ModelResponse:
    tools = {tool.name for tool in info.function_tools}
    last = messages[-1] if messages else None
    if isinstance(last, ModelRequest):
        returns = [p for p in last.parts if isinstance(p, ToolReturnPart)]
        # A new user message next to stale denials means "answer the new message".
        has_prompt = any(isinstance(p, UserPromptPart) for p in last.parts)
        if returns and not has_prompt:
            follow_up = _follow_up(returns, tools, messages)
            return (
                ModelResponse(parts=[follow_up], model_name=OFFLINE_MODEL_NAME)
                if follow_up
                else (
                    ModelResponse(
                        parts=[TextPart(_summarize(returns))], model_name=OFFLINE_MODEL_NAME
                    )
                )
            )
        if any(isinstance(p, RetryPromptPart) for p in last.parts):
            return ModelResponse(
                parts=[TextPart("Не получилось разобрать запрос — уточни, пожалуйста, детали.")],
                model_name=OFFLINE_MODEL_NAME,
            )
    intent = route(_user_prompt(messages), tools, today_fn())
    part = _tool_call(intent.tool, intent.args) if intent.tool else TextPart(intent.text or "")
    return ModelResponse(parts=[part], model_name=OFFLINE_MODEL_NAME)


def _follow_up(
    returns: Sequence[ToolReturnPart], tools: set[str], messages: Sequence[ModelMessage]
) -> ToolCallPart | None:
    """No answer in the docs -> offer the mentor; a sensitive topic -> offer HRBP. Only once."""
    if "ask_mentor" not in tools or _called(messages, "ask_mentor"):
        return None
    for part in returns:
        content = part.content if isinstance(part.content, dict) else {}
        if part.tool_name == "search_knowledge" and content.get("sensitive"):
            return _tool_call(
                "ask_mentor", {"question": _user_prompt(messages), "kind": "sensitive"}
            )
        if part.tool_name == "search_knowledge" and content.get("found") is False:
            return _tool_call("ask_mentor", {"question": _user_prompt(messages)})
    return None


def build_offline_model(today_fn: Callable[[], date]) -> FunctionModel:
    def function(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        return respond(messages, info, today_fn=today_fn)

    async def stream(
        messages: list[ModelMessage], info: AgentInfo
    ) -> AsyncIterator[str | DeltaToolCalls]:
        response = respond(messages, info, today_fn=today_fn)
        for part in response.parts:
            if isinstance(part, TextPart):
                for start in range(0, len(part.content), _CHUNK):
                    yield part.content[start : start + _CHUNK]
            elif isinstance(part, ToolCallPart):
                yield {
                    0: DeltaToolCall(
                        name=part.tool_name,
                        json_args=json.dumps(part.args_as_dict(), ensure_ascii=False),
                        tool_call_id=part.tool_call_id,
                    )
                }

    return FunctionModel(function, stream_function=stream, model_name=OFFLINE_MODEL_NAME)
