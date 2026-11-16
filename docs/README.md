# Документация

Запуск, учётки и порядок проверки описаны в [README](../README.md). Здесь всё остальное.

## Для жюри

| Файл | Что в нём |
|---|---|
| [../PRODUCT.md](../PRODUCT.md) | проблема, роли, сценарии, метрики пользы и план A/B |
| [ARCHITECTURE.md](ARCHITECTURE.md) | бэкенд, агент, права, интеграции и почему они устроены так |
| [../specs/](../specs/) | SDD-спецификации сценариев (SpecKit) и CJM первых недель |
| [quality/coverage-summary.md](quality/coverage-summary.md) | снимок покрытия тестами и файлы отчётов |
| [quality/performance.md](quality/performance.md) | нагрузочный тест и задержки |
| [api/openapi.json](api/openapi.json) | контракт API; живой Swagger на `/api/docs` |
| [presentation/](presentation/) | презентация (PDF и PPTX) и её исходники |
| [demo/orbi-demo.mp4](demo/orbi-demo.mp4) | видео от запроса до результата |

## Кейс

Требования берутся только отсюда, остальные документы описывают решения команды.

| Файл | Что в нём |
|---|---|
| [case/TASK.md](case/TASK.md) | полное ТЗ Авито ([PDF](case/avito-case.pdf)) |
| [case/QA.md](case/QA.md) | ответы Авито на вопросы команд |
| [case/CASE_BRIEF.md](case/CASE_BRIEF.md) | выжимка требований, сроков и критериев |
| [case/intern-checklist.md](case/intern-checklist.md) | чек-лист стажёра, из которого собран план адаптации |

## Для разработчиков

| Файл | Когда читать |
|---|---|
| [STATUS.md](STATUS.md) | в начале работы: что готово и что дальше |
| [DECISIONS.md](DECISIONS.md) | перед тем как менять подход: причина, скорее всего, записана там |
| [../DESIGN.md](../DESIGN.md) | дизайн-система портала и спутника |
| [frontend/COMPANION.md](frontend/COMPANION.md) | как ведёт себя спутник на фронтенде |
| [frontend/API_INTEGRATION.md](frontend/API_INTEGRATION.md) | какие вызовы API нужны каждому экрану и как читать поток чата |
| [integration/SDK_SERVER.md](integration/SDK_SERVER.md) | сервер для npm-пакета: импорт знаний, MCP, контекст |
| [../frontend/packages/react/README.md](../frontend/packages/react/README.md) | установка и API пакета `@orbi-companion/react` |
| [../corp-mock/README.md](../corp-mock/README.md) | имитация корпоративных сервисов и её админ-ручки |
| [guides/windows.md](guides/windows.md) | тесты и покрытие без `make` |

## Эксплуатация

| Файл | Что в нём |
|---|---|
| [../deploy/fly/README.md](../deploy/fly/README.md) | стенд на Fly.io: приложения, деплой, откат, DNS |
| [../deploy/observability/README.md](../deploy/observability/README.md) | Prometheus, Grafana, алерты и имитация Clickstream |
| [../deploy/home/README.md](../deploy/home/README.md) | прежний стенд на домашнем сервере |

Старые журналы и разборы лежат в [archive/](archive/) только для справки.
