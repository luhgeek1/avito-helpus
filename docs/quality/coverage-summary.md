# Снимок покрытия тестами

Снят 16.11.2026 полным прогоном `main` (`237c5b7`, с влитым React SDK) плюс исправление пути
в `frontend/vitest.sdk.config.ts` для Windows. Windows 11, Python 3.13, Node 24, настоящие
Postgres (pgvector) и Redis из `docker-compose.test.yml`.

| Часть | Тесты | Покрыто строк | Всего строк | Покрытие |
|---|---|---|---|---|
| Бэкенд (`backend/app`) | 432 (+1 с брокером, выключен по умолчанию) | 6376 | 6376 | 100% |
| Фронтенд (`frontend/src`, все файлы) | 220 | 3738 | 3738 | 100% |
| React SDK (`frontend/packages/react/src`) | 9 | 138 | 138 | 100% |
| **Итого** | **661** | **10252** | **10252** | **100%** |

Браузерные E2E полного стека (Playwright, офлайн-режим, 4 сценария) идут на каждом pull request
(D-033); последний локальный прогон — 4 из 4 (15.11.2026).

Без `pragma: no cover`, `v8 ignore` и сужения `include`/`omit` (D-030). Имитация корпоративных
сервисов (`corp-mock/`) в расчёт не входит (№72 Q&A). Порог 100% строк проверяет CI на каждом
pull request (D-033).

## Файлы

| Файл | Формат | SHA-256 |
|---|---|---|
| [coverage/backend-coverage.xml](coverage/backend-coverage.xml) | Cobertura (pytest-cov, `backend/app`) | `7a0a97a0b00deeb43d2cedc4c0709f55f5eed9abbb40863bb1a65a0d7f1cecb5` |
| [coverage/frontend-coverage-summary.json](coverage/frontend-coverage-summary.json) | Istanbul json-summary (Vitest, `frontend/src`) | `8418855cb4ffc676bd15fea38cbcea310aabcdf709866eec7876da150e56aae3` |
| [coverage/sdk-coverage-summary.json](coverage/sdk-coverage-summary.json) | Istanbul json-summary (Vitest, `frontend/packages/react/src`) | `3aeb667fd10ab60f1cbb259924dd7e1689595fa0dad895c037e6f15698748d21` |

Пути исходников в копиях сделаны относительными от корня репозитория.

## Воспроизвести

`make coverage` или команды без make из README (раздел «Тесты и покрытие»): тестовые БД,
`uv run pytest --cov=app …` в `backend/`, `npm --prefix frontend run coverage` (портал и SDK),
`python deploy/coverage_report.py` — итог в `reports/coverage-summary.md`. Снимок не заменяет
новый прогон после изменений.
