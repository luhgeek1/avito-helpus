# Подключение фронтенда к API Орби

Гайд для фронтендеров: что вызывать на каждом экране и как читать поток чата.

**Уже реализовано** (ветка `feat/frontend-integration`): клиент и хуки — `frontend/src/shared/api/orbi`,
чат и карточки — `frontend/src/features/orbi-chat`, вход — `features/orbi-auth`, экраны —
`frontend/src/_pages/orbi` (`/login`, `/plan`, `/requests`, `/questions`, `/mentor`). Новые экраны
строятся на хуках из `@/shared/api` (`usePlan`, `useRequests`, `useMentees`…) и `useOrbiChat().ask(…)`
для кнопок «Сделать с Орби». Тесты с фикстурами реального API — `frontend/tests/orbi`. Полная схема —
[docs/api/openapi.json](../api/openapi.json) или Swagger UI на `http://localhost/api/docs`.
Типы можно сгенерировать: `npx openapi-typescript docs/api/openapi.json -o frontend/src/shared/api/orbi/schema.d.ts`.

## Запуск бэкенда рядом с фронтендом

```sh
docker compose up -d --build   # всё вместе на http://localhost (портал + /api/v1)
# или для разработки фронтенда с hot reload:
docker compose up -d api worker corp-mock db redis   # API на http://localhost:8080
npm --prefix frontend run dev                         # портал на :5173
```

При разработке на `:5173` проксируйте `/api/v1` на `http://localhost:8080` (rewrites в
`next.config.ts`) или задайте `CORS_ALLOW_ORIGINS=http://localhost:5173` для API. Декоративные
разделы портала (`/api/me`, `/api/feed` и т. п. без `/v1`) остаются на MSW; запросы к `/api/v1/*`
MSW должен пропускать (`onUnhandledRequest: "bypass"` и без обработчиков для этих путей).

## Вход

| Шаг | Запрос |
|---|---|
| Вход | `POST /api/v1/auth/login {email, password}` → `{access_token, expires_in}`; refresh приходит httpOnly-cookie, `csrf_token` — читаемой cookie |
| Запросы | `Authorization: Bearer <access_token>` (токен держим в памяти, не в localStorage) |
| Обновление | `POST /api/v1/auth/refresh` с заголовком `X-CSRF-Token: <cookie csrf_token>` → новый access |
| Выход | `POST /api/v1/auth/logout` |
| Кто я | `GET /api/v1/me`: роль, команда, наставник, день стажировки, `permissions`, `flags`, `assistant_mode` |

Демо-учётки и пароль — в README. По `permissions` решаем, что показывать: `mentees:read` → экран
наставника, `analytics:read` → метрики.

## Экраны

| Экран | Запросы |
|---|---|
| «Мой путь» | `GET /plan` (этапы, `next_steps`, `percent`); `POST /plan/items/{id}/transitions {transition}` (`start`, `complete`, `submit_review`, `block`, `unblock`); `POST /plan/items/{id}/quiz {answers}` |
| Кнопка «Сделать с Орби» | у шага есть `action` (`access_request` с `resource`, `absence_request`, `equipment`, `ask_mentor`) — открыть чат с подготовленной фразой, например «Нужен доступ к {resource}» |
| «Мои заявки» | `GET /requests`, `GET /requests/{id}` (с `history`), `POST /requests/{id}/cancel`, `POST /requests/{id}/remind` |
| Заявка без чата | `POST /requests/access/preview` → карточка; `POST /requests/access {…, idempotency_key}`; то же для `absence` и `it-ticket` |
| Ноутбук | `GET /equipment` (статус, место выдачи, `meanwhile` — что делать пока) |
| Мои вопросы | `GET /escalations`, `POST /escalations {question}`, `POST /escalations/{id}/close` |
| Наставник | `GET /mentees`, `GET /mentees/{id}`, `POST /mentees/{id}/plan/items/{item_id}/review {transition: approve|return|complete, comment}`, `GET /escalations?scope=assigned`, `POST /escalations/{id}/answer {answer, publish_to_faq}` |
| Уведомления | `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, поток `GET /events` |
| Поиск по базе знаний | `GET /knowledge/search?q=` (источники и противоречия), `GET /knowledge/documents/{slug}`, `POST /knowledge/conflicts/{id}/report` |

Все пути выше — относительно `/api/v1`. Ошибки — RFC 7807: ветвимся по `error_code`
(например `PLAN_QUIZ_REQUIRED`, `ACTION_EXPIRED`, `REMIND_TOO_SOON`), а не по тексту.

## Чат

1. `POST /chat/conversations` → `{id}` (или берём последний из `GET /chat/conversations`).
2. История: `GET /chat/conversations/{id}` → `messages[].parts` в том же формате, что поток.
3. Сообщение: `POST /chat/conversations/{id}/messages {text}` → поток SSE.
4. Решение по карточке: `POST /chat/conversations/{id}/actions/{action_id} {decision: "approve"|"reject", edits?: {…}}` → поток SSE с продолжением.
5. Оценка ответа: `POST /chat/messages/{message_id}/feedback {rating: "up"|"down"}`.

Поток — формат Vercel AI SDK UI message stream v1 (заголовок `x-vercel-ai-ui-message-stream: v1`):
строки `data: {json}`, в конце `data: [DONE]`. Можно читать вручную или подключить `useChat` из
`@ai-sdk/react` с собственным транспортом, который шлёт `{text}` на наш путь.

| Чанк | Что показать |
|---|---|
| `start` | `messageMetadata.mode`: `online` или `offline` (бейдж «офлайн-режим») |
| `data-status` (transient) | строка статуса над пузырём: «Ищу в базе знаний», «Готовлю заявку на доступ» |
| `text-start` / `text-delta` / `text-end` | текст ответа, печатается по мере прихода |
| `data-sources` | `sources[]`: `n`, `title`, `section`, `excerpt`, `updated_at`, `synthetic`, `stale`; `conflicts[]` с обеими цитатами и кнопкой «Уточнить у наставника» (`POST /knowledge/conflicts/{id}/report`) |
| `data-action` | карточка подтверждения: `id`, `card.title`, `card.service`, `card.fields[]` (`editable` → можно поправить), `card.warnings[]`, `expires_at`; кнопки «Подтвердить» / «Отменить» |
| `data-request` | карточка заявки: `external_id`, `status_title`, согласующий, срок |
| `data-escalation` | «Вопрос передан: Иван Петров, ответ до …» |
| `data-plan`, `data-equipment` | мини-виджеты плана и техники |
| `tool-input-available` / `tool-output-available` | можно не показывать (отладка) |
| `error` | «Орби сейчас не может ответить» и кнопка «Повторить» |
| `finish` | конец ответа, `messageMetadata.messageId` |

Правки в карточке отправляются ключами полей: `{"level": "write", "justification": "…"}` для
доступа, `{"comment": "…"}` для отгула, `{"question": "…"}` для вопроса наставнику.

Минимальное чтение потока без библиотек:

```ts
async function* readOrbiStream(response: Response) {
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const data = event.replace(/^data: /, "");
      if (data === "[DONE]") return;
      if (data.startsWith("{")) yield JSON.parse(data) as { type: string; [key: string]: unknown };
    }
  }
}
```

## Realtime

`GET /events` — SSE с заголовком авторизации (используйте `fetch` со стримингом, `EventSource` не
умеет заголовки). События: `notification.created`, `request.updated`, `plan.updated`,
`escalation.updated`. По ним инвалидируем запросы TanStack Query (`plan`, `requests`,
`notifications`) и показываем тост от Орби.
