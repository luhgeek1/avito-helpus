# Проверка npm-пакета

15.11.2026, ветка `feat/orbi-react-sdk`. Chromium/Playwright на macOS.

- Настоящий `.tgz` установлен через npm в две новые временные папки вне репозитория;
  React/Vite и Next.js собраны в production. React 19.1 дополнительно проверен в Vite,
  React 19.3 — в Next.js. React не дублируется в библиотеке.
- `verification.json`: 1440×900 и 390×900, изоляция CSS, повторное открытие чата, история,
  Spotlight, гардероб, настройки, знакомство, удаление/возврат виджета. JavaScript-ошибок нет.
- API работал на 8088, corp-mock MCP на 8099, тестовые Postgres/Redis на 5439/6380.
  Браузерные ответы не подменялись. `tests/sdk_server.py` создаёт только синтетические данные
  в фиксированной тестовой БД, импортирует пример знаний и запускает настоящий воркер.
- `imported-knowledge.png`: импортированный Markdown найден агентом и показан в источниках.
  `confirmation.png`: карточка доступа до отправки. `notification.png`: уведомление после
  подтверждения, реального MCP-вызова и подписанного веб-хука.
- `integration-*.png`: обновлённый раздел установки на главной, без переполнения.

Воспроизведение: `npm run sdk:verify` в frontend печатает временную папку с двумя приложениями.
Запустите в её подпапках `npm start` (5184/5185). Для полного сценария нужны `make test-deps`,
миграции тестовой БД и два процесса:

```sh
# Из corp-mock:
MOCK_APPROVAL_DELAY_SEC=8 BUDDY_WEBHOOK_URL=http://127.0.0.1:8088/api/v1/integrations/corp/webhook \
  uv run uvicorn corp_mock.server:app --host 127.0.0.1 --port 8099
# Из backend: только тестовый стенд; fixture сбрасывает buddy_test.
uv run uvicorn tests.sdk_server:app --host 127.0.0.1 --port 8088
# Из корня:
node frontend/packages/react/scripts/verify-browser.mjs
```

Тест полного сценария рассчитан на свежий стенд: повтор требует перезапуска API и corp-mock,
чтобы заявка на listings-api ещё не была исполнена. Файл отчёта записывается только локально;
публикацию npm и деплой эта проверка не выполняет.
