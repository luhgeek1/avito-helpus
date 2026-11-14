"""Retrieval quality on the demo knowledge base (spec 003, SC-001).

Each question names the document a good answer must cite. The suite reports recall@5 and fails
below 90%; no hidden document may ever appear for an intern of another team or role.
"""

from httpx import AsyncClient

from tests.integration.conftest import Account

EVAL: list[tuple[str, str]] = [
    ("Куда отправить PR?", "team-listings-handbook"),
    ("Кого позвать на ревью?", "team-listings-handbook"),
    ("Как называть ветки?", "team-listings-handbook"),
    ("Как проверить фичу на dev?", "team-listings-handbook"),
    ("Когда стендап у команды?", "team-listings-handbook"),
    ("Как скачать репозиторий?", "git-workflow"),
    ("Как добавить SSH-ключ в Stash?", "git-workflow"),
    ("Как открыть pull request?", "git-workflow"),
    ("Как получить доступ к Jira?", "access-policy"),
    ("Кто согласует заявку на доступ?", "access-policy"),
    ("Что делать, если в доступе отказали?", "access-policy"),
    ("Сколько ждать согласования доступа?", "access-policy"),
    ("Когда выдадут ноутбук?", "equipment"),
    ("Что делать, пока нет ноутбука?", "equipment"),
    ("Как взять отгул?", "absence-policy"),
    ("За сколько дней подавать отпуск?", "absence-policy"),
    ("Что делать, если заболел?", "absence-policy"),
    ("Как настроить avito-cli?", "dev-environment"),
    ("Сервис не запускается локально, падают миграции", "dev-environment"),
    ("Как выкатить ветку на стейджинг?", "team-listings-handbook"),
    ("Можно ли использовать код от LLM?", "dev-principles"),
    ("Когда нужен design review?", "dev-principles"),
    ("Можно ли выгрузить данные пользователей в таблицу?", "data-protection"),
    ("Что такое Redash?", "tools-overview"),
    ("Зачем нужен Sentry?", "tools-overview"),
    ("Где лежат цели и ИПР?", "ipr-and-goals"),
    ("Кому задать деликатный вопрос?", "escalation-guide"),
    ("Когда релизы у команды?", "team-listings-releases"),
    ("С чего начать в первый день?", "onboarding-first-week"),
]

HIDDEN_FOR_LISTINGS_INTERN = {"team-payments-handbook", "mentor-guide"}
RECALL_THRESHOLD = 0.9


async def _top(client: AsyncClient, account: Account, question: str) -> list[str]:
    response = await client.get(
        "/api/v1/knowledge/search", params={"q": question, "limit": 5}, headers=account.headers
    )
    return [source["document_slug"] for source in response.json()["sources"]]


async def test_recall_at_5(client: AsyncClient, anya: Account) -> None:
    misses = []
    for question, expected in EVAL:
        if expected not in await _top(client, anya, question):
            misses.append((question, expected))

    recall = 1 - len(misses) / len(EVAL)
    assert recall >= RECALL_THRESHOLD, f"recall@5 = {recall:.2f}, misses: {misses}"


async def test_hidden_documents_never_leak(client: AsyncClient, anya: Account) -> None:
    probes = [question for question, _ in EVAL] + [
        "платёжные токены ротация ключей",
        "методичка наставника нагрузка",
        "security-чек платёжного контура",
    ]
    for question in probes:
        assert not HIDDEN_FOR_LISTINGS_INTERN & set(await _top(client, anya, question)), question
