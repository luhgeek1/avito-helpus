# corp-mock: имитация корпоративных сервисов

Отдельный сервис, который изображает корпоративные системы демо-компании: сервис доступов,
сервис отсутствий, календарь, IT-поддержку, справочник и мессенджер. Интерфейс — MCP
(streamable HTTP, `POST /mcp`), как рекомендовали организаторы (№62 Q&A). Код mock не входит в
покрытие тестами (№72).

Бэкенд Орби подключается к нему через порт `CorpServices` (`backend/app/service/ports.py`) и
адаптер `McpCorpServices`. Чтобы подключить настоящий сервис (Jira Service Desk, внутренний сервис
доступов), пишется ещё один адаптер того же порта — домен и агент не меняются.

## Инструменты MCP

| Сервис | Инструменты |
|---|---|
| Доступы | `access_check`, `access_create_request`, `access_get_request`, `access_remind` |
| Отсутствия | `absence_balance`, `absence_create_request`, `absence_get_request` |
| Календарь | `calendar_events` |
| IT-поддержка | `itsupport_equipment`, `itsupport_create_ticket`, `itsupport_get_ticket` |
| Мессенджер | `messenger_post` |

Создание заявок идемпотентно по `idempotency_key`. Решение приходит через
`MOCK_APPROVAL_DELAY_SEC` секунд веб-хуком на `BUDDY_WEBHOOK_URL` с заголовками
`X-Corp-Timestamp` и `X-Corp-Signature: sha256=HMAC(CORP_WEBHOOK_SECRET, "<timestamp>.<body>")`.

Правила решений детерминированные:

- заявка на уровень «администрирование» отклоняется;
- обоснование короче 15 символов отклоняется;
- отсутствие дольше остатка дней отклоняется;
- остальные заявки одобряются.

## Управление для демо

| Запрос | Что делает |
|---|---|
| `GET /health` | проверка живости |
| `GET /admin/state` | заявки, сообщения в каналах, выданные доступы |
| `POST /admin/faults {"mode": "unavailable"}` | имитирует недоступность сервиса (`"ok"` возвращает) |
| `POST /admin/decide {"request_id": "ACC-1042", "status": "approved"}` | решение сразу, без ожидания |
| `POST /admin/reset` | вернуть исходное состояние |

## Запуск отдельно

```sh
uv sync
MOCK_APPROVAL_DELAY_SEC=5 uv run uvicorn corp_mock.server:app --port 8090
```
