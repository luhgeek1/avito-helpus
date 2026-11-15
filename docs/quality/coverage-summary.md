# Снимок покрытия тестами

Снят 16.11.2026 полным прогоном `main` (`19c48bd`: React SDK, видео, правки разделителей) плюс
исправление пути в `frontend/vitest.sdk.config.ts` для Windows. Windows 11, Python 3.13, Node 24,
настоящие Postgres (pgvector) и Redis из `docker-compose.test.yml`.

| Часть | Тесты | Покрыто строк | Всего строк | Покрытие |
|---|---|---|---|---|
| Бэкенд (`backend/app`) | 432 (+1 с брокером, выключен по умолчанию) | 6376 | 6376 | 100% |
| Фронтенд (`frontend/src`, все файлы) | 220 | 3739 | 3739 | 100% |
| React SDK (`frontend/packages/react/src`) | 9 | 138 | 138 | 100% |
| **Итого** | **661** | **10253** | **10253** | **100%** |

Фронтенд дополнительно: операторы 98,21%, функции 99,07%, ветви 89,65%. SDK: операторы 99,03%,
функции 100%, ветви 93%. Порог CI — 100% строк.

Браузерные E2E полного стека (Playwright, офлайн-режим, 4 сценария) идут на каждом pull request
(D-033).

Без `pragma: no cover`, `v8 ignore` и сужения `include`/`omit` (D-030). Имитация корпоративных
сервисов (`corp-mock/`) в расчёт не входит (№72 Q&A). Порог 100% строк проверяет CI на каждом
pull request (D-033).

## Устранённые гонки тестов

- **Фронтенд, исправлено.** Тест гардероба завершался раньше первого кадра анимации, и на быстрой
  машине 10 строк `use-wardrobe-carousel.ts` оставались непокрытыми (99,73%, порог не проходил).
  Тест теперь ждёт два кадра; три прогона подряд — 100%.
- **Бэкенд, исправлено.** Строка 42 `app/infra/bus.py` (`await pubsub.aclose()`) покрывалась не в
  каждом прогоне: тест выходил из `async for`, и генератор подписки закрывал сборщик мусора.
  Теперь тест закрывает его через `aclosing()` и проверяет, что в канале Redis не осталось
  подписчиков.
- **SDK на Windows, исправлено.** Подмена модуля сессии SDK в `vitest.sdk.config.ts` сравнивала
  путь с прямыми слешами и на Windows не срабатывала; теперь путь нормализуется.

## Файлы

| Файл | Формат | SHA-256 |
|---|---|---|
| [coverage/backend-coverage.xml](coverage/backend-coverage.xml) | Cobertura (pytest-cov, `backend/app`) | `9d3adbe7963f2f1f963389b642730d7f426a9c014cba3190e3192f0fc3e3d262` |
| [coverage/frontend-coverage-summary.json](coverage/frontend-coverage-summary.json) | Istanbul json-summary (Vitest, `frontend/src`) | `8b95e0779b42e24310d7626f3990d3d6bacc8751f2f8552b477dc93a6a0ddd59` |
| [coverage/sdk-coverage-summary.json](coverage/sdk-coverage-summary.json) | Istanbul json-summary (Vitest, `frontend/packages/react/src`) | `3aeb667fd10ab60f1cbb259924dd7e1689595fa0dad895c037e6f15698748d21` |

Пути исходников в копиях сделаны относительными от корня репозитория.

## Воспроизвести

`make coverage` или команды без make из README (раздел «Тесты и покрытие»): тестовые БД,
`uv run pytest --cov=app …` в `backend/`, `npm --prefix frontend run coverage` (портал и SDK),
`python deploy/coverage_report.py` — итог в `reports/coverage-summary.md`. Снимок не заменяет
новый прогон после изменений.
