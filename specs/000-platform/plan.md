# План реализации: платформа Орби

**Спецификации**: 001–007 · **Создано**: 14.11.2026

## Технический контекст

| | |
|---|---|
| Язык | Python 3.13 (бэкенд, corp-mock), TypeScript (фронтенд) |
| Бэкенд | FastAPI, SQLAlchemy 2 async, asyncpg, Alembic, Pydantic 2, pydantic-settings |
| Агент | Pydantic AI v2 (`Agent`, deferred tools, `FallbackModel`, `FunctionModel`, `Embedder`) |
| LLM | OpenAI `gpt-5.4-mini` (диалог), `gpt-5.4` (сводки, противоречия), `text-embedding-3-large` (1024) |
| Интеграции | MCP (streamable HTTP) к `corp-mock`, веб-хуки с HMAC |
| Хранилища | PostgreSQL 17 + pgvector, Redis 8 (pub/sub для SSE, лимиты) |
| Фронтенд | Next.js 16, React 19, TanStack Query, Zustand, Zod (существующий портал) |
| Тесты | pytest, pytest-asyncio, pytest-cov; настоящие Postgres и Redis из `docker-compose.test.yml` |
| Производительность | локальные операции < 1 с, первый байт SSE < 300 мс |
| Ограничения | синтетические данные, без GPU, один ключ LLM или офлайн-режим |

## Проверка по конституции

| Принцип | Как выполняется |
|---|---|
| II. LLM предлагает | `ApprovalRequired` в инструментах, `pending_actions`, повторная проверка прав, идемпотентность по `tool_call_id` |
| III. Права до данных | `ROLE_PERMISSIONS`, ABAC-функции в `domain/`, фильтр инструментов (`prepare`), фильтр видимости в SQL |
| IV. Источники | `data-sources` с датой и пометкой, `kb_conflicts` |
| V. Человек в контуре | `escalations` с лестницей и SLA |
| VI. Отказоустойчивость | SSE, `FallbackModel` → офлайн, outbox с повторами, сверка зависших заявок |
| VII. Внедряемость | порт `CorpServices` + MCP-адаптер, инструменты — тонкие обёртки над сервисами |
| VIII. Проверяемость | unit на домен, integration на каждый эндпоинт, сценарии агента на `FunctionModel` |

## Структура

```text
backend/app/
  domain/     правила: users (роли, права), plan, requests, access, absence, knowledge, escalations, flags
  db/         ORM-модели, репозитории, UnitOfWork
  infra/      corp (MCP-клиент), llm (модели, эмбеддинги), bus (Redis pub/sub), metrics, rate_limit
  service/    plan, requests, knowledge, escalations, mentor, notifications, analytics, nudges,
              assistant/ (агент, инструменты, офлайн-модель, протокол потока)
  api/v1/     auth, me, plan, requests, knowledge, chat, escalations, mentees, notifications,
              events (SSE), integrations (веб-хуки), analytics, admin
  seed/       синтетическая компания, команды, люди, план, база знаний
corp-mock/    MCP-сервер: access, absence, calendar, itsupport, directory, messenger
```

## Контракт API (v1, префикс `/api/v1`)

| Область | Эндпоинты |
|---|---|
| Вход | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all` |
| Профиль | `GET /me` (роль, команда, наставник, руководитель, HRBP, день стажировки, права, флаги), `GET /team` |
| План | `GET /plan`, `POST /plan/items/{id}/transitions`, `POST /plan/items/{id}/quiz` |
| Заявки | `GET /requests`, `GET /requests/{id}`, `POST /requests/{id}/cancel`, `POST /requests/{id}/remind`, `GET /access/resources`, `POST /requests/access/preview`, `POST /requests/access` |
| Знания | `GET /knowledge/search?q=`, `GET /knowledge/documents/{slug}`, `POST /knowledge/conflicts/{id}/report` |
| Чат | `GET/POST /chat/conversations`, `GET /chat/conversations/{id}`, `POST /chat/conversations/{id}/messages` (SSE), `POST /chat/conversations/{id}/actions/{action_id}` (SSE), `POST /chat/messages/{id}/feedback`, `GET /assistant/status` |
| Эскалации | `GET /escalations`, `POST /escalations`, `POST /escalations/{id}/answer`, `POST /escalations/{id}/close` |
| Наставник | `GET /mentees`, `GET /mentees/{id}`, `POST /mentees/{id}/plan/items/{item_id}/review` |
| Уведомления | `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, `GET /events` (SSE) |
| Интеграции | `POST /integrations/corp/webhook` (HMAC) |
| Аналитика | `GET /analytics/summary`, `POST /analytics/events` |
| Админ | `GET /admin/flags`, `PUT /admin/flags/{key}`, `GET /admin/audit`, `POST /admin/demo/reset` |
| Система | `GET /api/health`, `GET /api/ready`, `GET /api/metrics` |

Полная схема — OpenAPI (`/api/docs`, экспорт в `docs/api/openapi.json`). Ошибки — RFC 7807 с `error_code`.

## Поток чата (SSE, формат AI SDK UI message stream v1)

```text
start → data-status("Думаю…") → [tool-input-available → data-status → tool-output-available
       → data-sources | data-request | data-escalation]* → text-start → text-delta* → text-end
       → [data-action (карточка подтверждения)] → finish → [DONE]
```

Ошибка модели → `data-status(offline)` и продолжение офлайн-моделью; фатальная ошибка → `error`.

## Контракт MCP `corp-mock`

| Сервис | Инструменты |
|---|---|
| access | `access_check(employee_id, resource)`, `access_create_request(employee_id, resource, level, justification, approver, idempotency_key)`, `access_get_request(request_id)`, `access_remind(request_id)` |
| absence | `absence_balance(employee_id)`, `absence_create_request(employee_id, type, start_date, end_date, comment, idempotency_key)`, `absence_get_request(request_id)` |
| calendar | `calendar_events(employee_id, date_from, date_to)` |
| itsupport | `itsupport_equipment(employee_id)`, `itsupport_create_ticket(employee_id, category, description, idempotency_key)`, `itsupport_get_ticket(ticket_id)` |
| directory | `directory_find(query)` |
| messenger | `messenger_post(channel, text, author_id, idempotency_key)` |

Решения по заявкам corp-mock присылает на `POST /api/v1/integrations/corp/webhook`
(`X-Corp-Timestamp`, `X-Corp-Signature: sha256=HMAC(secret, timestamp.body)`). Управление имитацией:
`MOCK_APPROVAL_DELAY_SEC`, правило отказа (обоснование короче 15 символов), переключатель сбоев
`POST /admin/faults` у corp-mock.

## Безопасность

- JWT RS256 (15 мин) + refresh в httpOnly-cookie с CSRF (шаблон), без регистрации (SSO имитируется сидом).
- RBAC + ABAC; закрытое не раскрывается (404 вместо 403 там, где факт существования чувствителен).
- Промпт-инъекции: документы в разметке `<document>`, инструкции из данных игнорируются, действия
  только через подтверждение.
- Веб-хуки: HMAC и окно времени; лимит сообщений чата; аудит решений и заявок.
- Секреты только из окружения; в `APP_STAGE=prod` приложение не стартует с dev-значениями.

## Тестирование

- unit: доменные правила (переходы плана, доступ, отсутствия, эскалации, RRF, флаги), офлайн-модель,
  протокол потока.
- integration: каждый эндпоинт; сценарии агента с `FunctionModel`; веб-хуки; воркер и AI-крон;
  `FakeCorpServices` вместо MCP; отдельный тест MCP-адаптера против настоящего `corp-mock` в памяти.
- eval: набор вопросов к базе знаний с ожидаемыми документами и закрытыми документами.
- Покрытие: `make coverage` → Cobertura/LCOV бэкенда и фронтенда, общий процент — `make coverage-report`.
