# Правила работы над проектом

AI-buddy «Орби» для стажёров Авито, хакатон Hack&Change 2026. Общайся с пользователем на русском.

## Ритуал сессии

1. В начале прочитай [docs/STATUS.md](docs/STATUS.md) и [docs/DECISIONS.md](docs/DECISIONS.md),
   затем документы своей области (карта ниже).
2. Требования берутся только из кейса: [docs/case/CASE_BRIEF.md](docs/case/CASE_BRIEF.md) (выжимка),
   [docs/case/TASK.md](docs/case/TASK.md) (полное ТЗ), [docs/case/QA.md](docs/case/QA.md) (ответы Авито).
   Наши документы — решения команды, а не требования.
3. В конце значимого этапа перепиши `docs/STATUS.md` (коротко: что готово, что в работе, что дальше)
   и добавь решения в `docs/DECISIONS.md` (D-xxx: что, почему, что отвергли). Журналы правок не веди.

## Карта

| Где | Что |
|---|---|
| [PRODUCT.md](PRODUCT.md) | продукт: проблема, роли, сценарии, принципы, метрики |
| [DESIGN.md](DESIGN.md) | дизайн-система и история визуальных решений |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | архитектура бэкенда, агента и интеграций |
| [docs/frontend/COMPANION.md](docs/frontend/COMPANION.md) | согласованное поведение спутника Орби на фронтенде |
| `specs/` | SDD-спецификации SpecKit по сценариям |
| `backend/` | FastAPI-монолит (API + воркер) |
| `corp-mock/` | MCP-имитация корпоративных сервисов Авито |
| `frontend/` | Next.js-портал «Хаб» и спутник; подробности в `frontend/README.md` |
| `docs/archive/` | старые журналы, только для справки |

## Общие правила

- Только синтетические данные. Тестовые инструкции помечаются как тестовые и не выдаются за регламенты Авито.
- Код, комментарии и сообщения коммитов — на английском; интерфейс и документация — на русском.
- Коммиты: один логический шаг на коммит (обычно до нескольких сотен строк). Каркасы, сгенерированные
  файлы, lockfile и документация идут целиком. Не коммить секреты (`.env` в `.gitignore`).
- В корне: документы, `docker-compose*.yml`, `Makefile`, `.github/`, `backend/`, `frontend/`,
  `corp-mock/`, `deploy/`, `docs/`, `specs/`. Материалы фронтенда (изображения, отчёты) — в `frontend/design/`.
- Перед завершением: проверки затронутой части (ниже) зелёные; изменённые экраны проверены на десктопе и телефоне.

## Бэкенд (`backend/`)

- Перед изменениями прочитай [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Слои `api → service → domain`; `db` и `infra` — адаптеры. `domain/` не импортирует FastAPI,
  SQLAlchemy и Pydantic; `service/` не импортирует FastAPI; `api/` не строит SQL.
- Одна транзакция на запрос: коммитит только владелец UoW (`UowDep`, воркер, CLI, инструмент агента).
  Сервисы делают `flush()`.
- Побочные эффекты (вызовы corp-mock, уведомления, индексация) — через outbox, обработчики идемпотентны.
- Ожидаемые ошибки — `DomainError` с `ErrorCode`. Права — `require(Permission.X)` и правила в `domain/`.
- Инструменты агента — тонкие обёртки над сервисами; действие с последствиями только через
  подтверждение (`ApprovalRequired`) и с повторной проверкой прав.
- Новые таблицы: модель + миграция с рабочим `downgrade()`.
- Проверки: `make check` (ruff, mypy --strict, pytest с покрытием).
- Документация библиотек — через Context7, а не по памяти.

## Фронтенд (`frontend/`)

- Самостоятельное приложение: `npm ci`, `npm run dev`, `npm run build`, `npm test`,
  `npm run check:architecture` внутри `frontend/`.
- Стек: Next.js App Router, React, TypeScript, Tailwind CSS. Маршруты — в `frontend/app`,
  FSD-композиция — в `frontend/src/_app` и `frontend/src/_pages`.
- FSD: `_app → _pages → widgets → features → entities → shared`, только публичные API слайсов
  (`index.ts`), без импортов вверх и между слайсами одного слоя.
- Стили — Tailwind-утилиты в TSX. Без CSS-файлов компонентов, CSS Modules и CSS-in-JS.
  `frontend/app/globals.css` — только вход Tailwind, тема и keyframes — в `frontend/tailwind.config.ts`.
  Состояния — через `cx` (`shared/lib/cx`); inline-стили только для runtime-значений.
- Интерфейс — по [DESIGN.md](DESIGN.md).

### Спутник Орби

- Основной образ — оригинальный Орби (`orbit`): первый в группе, `defaultPet`, доступен по
  `/pets?pet=orbit`. Это первая версия с фиолетовыми боковыми деталями, ножками и розовым шарфом;
  защищай его 4 кадра. Не подменяй его другими вариантами.
- 15 вариаций `orbi-*` — парящие роботы без рук, ног и двигателей; частицы отделены от корпуса.
  Не возвращай им конечности. Детальная отрисовка 64×64: `orbi-base.ts` (форма 32×32),
  `orbi-sprites.ts`, `orbi-details.ts`, `orbi-detail-painter.ts`. У категории `orbi` обязателен `orbiDesign`.
- Новые маскоты — в `frontend/src/entities/pet/lib/mascot-sprites.ts`, исходная серия и диспетчер —
  в `sprite.ts`, данные и палитры — в `config/mascots.ts`, `config/pets.ts`, `config/orbi-family.ts`,
  на целочисленной сетке. Проверяй все кадры и reduced motion.
- Лайки (`buddy-favorites`) хранятся отдельно от выбранного спутника (`buddy-pet`); не сбрасывай их.
