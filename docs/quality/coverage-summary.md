# Снимок покрытия тестами

Снят 15.11.2026 полным прогоном на ветке `chore/final-specs-ci` (база `5848699` = `main` с влитым PR №3,
плюс изменения этой ветки). Windows 11, Python 3.13, Node 24, настоящие Postgres (pgvector) и Redis
из `docker-compose.test.yml`.

| Часть | Тесты | Покрыто строк | Всего строк | Покрытие |
|---|---|---|---|---|
| Бэкенд (`backend/app`) | 417 (+1 с брокером, выключен по умолчанию) | 6297 | 6297 | 100% |
| Фронтенд (`frontend/src`, все файлы) | 206 | 3588 | 3588 | 100% |
| **Итого** | **623** | **9885** | **9885** | **100%** |

Браузерные E2E полного стека (Playwright, офлайн-режим): 4 из 4 прошли против локального
`docker compose` через nginx.

Без `pragma: no cover`, `v8 ignore` и сужения `include`/`omit` (D-030). Имитация корпоративных
сервисов (`corp-mock/`) в расчёт не входит (№72 Q&A). Порог 100% строк проверяет CI на каждом
pull request (D-033).

## Файлы

| Файл | Формат | SHA-256 |
|---|---|---|
| [coverage/backend-coverage.xml](coverage/backend-coverage.xml) | Cobertura (pytest-cov, `backend/app`) | `d75622ce9d1aadf62604ea33a2fe6611861bdc53114eb3c894dcdfb4158490ef` |
| [coverage/frontend-coverage-summary.json](coverage/frontend-coverage-summary.json) | Istanbul json-summary (Vitest, `frontend/src`) | `718cb9da6dc08eb9a3f26a4ac9a5ca7076c227120bebd15af4f7f14a52500a87` |

Пути исходников в копиях сделаны относительными от корня репозитория.

## Воспроизвести

`make coverage` или команды без make из README (раздел «Тесты и покрытие»): тестовые БД,
`uv run pytest --cov=app …` в `backend/`, `npm --prefix frontend run coverage`,
`python deploy/coverage_report.py` — итог в `reports/coverage-summary.md`. Снимок не заменяет
новый прогон после изменений.
