# Проверка действий в браузере

Локальный полный стек, синтетическая Аня, offline-агент. Ширины 1440, 390 и 320 px,
reduced motion; исходный `orbit`. Снимки и `verification.json` создаёт `verify.mjs`.
Проверяются формы, подтверждение больничного, реальный MCP/webhook, календарь,
отмена/напоминание по доступу, квитанция сообщения, закрытие чата и сохранение черновика.

Запуск на одноразовой тестовой БД (fixture сбрасывает `buddy_test`, не рабочую БД):

1. `make test-deps`, затем `make check` для миграций и проверки.
2. В `corp-mock`: `MOCK_APPROVAL_DELAY_SEC=8 BUDDY_WEBHOOK_URL=http://127.0.0.1:8088/api/v1/integrations/corp/webhook uv run uvicorn corp_mock.server:app --port 8099`.
3. В `backend`: `uv run uvicorn tests.sdk_server:app --port 8088 --timeout-graceful-shutdown 2`.
4. В `frontend`: `ORBI_BACKEND_URL=http://127.0.0.1:8088 npx next dev --port 5186`.
5. Из корня: `node frontend/design/captures/workplace/verify.mjs`.

Перед повтором перезапустить оба Python-сервиса: нужны согласованно чистые состояния БД и MCP.
Во время прогона не запускать интеграционные pytest, которые сбрасывают ту же тестовую БД.
