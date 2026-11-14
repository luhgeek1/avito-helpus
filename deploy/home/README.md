# Деплой на домашний сервер (Sara)

Адрес: **https://avito.prooood.ru**. DNS: `avito CNAME home.prooood.ru`. Coolify Service `f87xwad3ydhgmn7ya4wrubos`,
приложение `avito`. Автодеплой: push в `main` → GitHub Actions → образы в GHCR → `sara-deploy` по SSH через Tailscale.

## Что запущено

Один Coolify Service из [docker-compose.yml](docker-compose.yml), без опубликованных портов, у каждого сервиса лимит памяти.

| Сервис | Образ | Роль |
|---|---|---|
| `web` | `avito-edge` | публичный nginx на 3000: `/` → портал, `/api/*` → API (SSE без буферизации), `/api/metrics` закрыт |
| `site` | `avito-web` | портал Next.js (сейчас на моках, к API не подключён) |
| `api` | `avito-api` | FastAPI-бэкенд |
| `worker` | `avito-api` | outbox, SLA-крон, напоминания |
| `migrate` | `avito-api` | одноразово: JWT-ключи, `alembic upgrade head`, сид демо-компании |
| `corp-mock` | `avito-corpmock` | MCP-имитация корпоративных сервисов |
| `db` | `pgvector/pgvector:0.8.1-pg17` | Postgres, том `postgres_data` |
| `redis` | `redis:8-alpine` | шина событий и лимиты |
| `db-backup` | `postgres-backup-local` | ежедневный дамп в `/srv/projects/avito/backups` |

Публичным сервисом названа `web`, потому что домен в Coolify создан именно для него (порт 3000). Поэтому nginx слушает 3000,
а портал называется `site`.

Секреты (пароль Postgres, `CSRF_HMAC_KEY`, `CORP_WEBHOOK_SECRET`) Coolify генерирует сам (`SERVICE_PASSWORD_*`).
Бэкенд стартует с `APP_STAGE=prod`: без этих секретов и `COOKIE_SECURE=true` он отказывается запускаться.

## LLM

Без ключа Орби работает в офлайн-режиме (те же инструменты и карточки, без модели). Сервер в России: прямой доступ к OpenAI
может быть закрыт по региону. Ключ и шлюз задаются на сервере и в образы не попадают:

```sh
printf '%s' "$KEY" | sara 'sara-app env-set avito LLM_API_KEY'
printf '%s' 'https://openrouter.ai/api/v1' | sara 'sara-app env-set avito LLM_BASE_URL'
printf '%s' 'openai/gpt-5.4-mini' | sara 'sara-app env-set avito LLM_MODEL'
sara 'sara-app restart avito'
```

Через `LLM_BASE_URL` бэкенд использует Chat Completions, без него — Responses API OpenAI. Эмбеддинги нужны тому же
провайдеру; без них работает полнотекстовый поиск.

## GitHub Actions

`.github/workflows/deploy-home.yml`: проверки бэкенда (ruff, mypy, pytest на Postgres в Docker) и фронтенда → сборка четырёх
образов `ghcr.io/luhgeek1/avito-{api,corpmock,web,edge}:<sha>` → деплой (только `main`) → публичные проверки
`/healthz`, `/api/health`, `/pets?pet=orbit`. На ветке `deploy/home-server` образы только собираются.
Каждый запуск собирает все образы, чтобы любой SHA можно было выкатить или откатить; слои кэшируются.

Секреты и переменные репозитория те же, что у фронтенда: `SARA_DEPLOY_KEY`, `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`,
`SARA_TAILSCALE_IP`, `SARA_HOST_KEY`, `AVITO_HOST`. Повторно получить команды: `sara 'sara-onboard ci avito luhgeek1/avito-helpus'`.

## Изменения compose

Workflow конфигурацию Coolify не меняет. После правки `docker-compose.yml`:

```sh
sara 'sara-app compose-put avito' < deploy/home/docker-compose.yml
sara 'sara-deploy avito <sha>'
```

## Эксплуатация

```sh
sara 'sara-app status avito'
sara 'sara-app logs avito api 100'
sara 'sara-deploy avito <предыдущий-sha>'   # откат
```

Демо-сид идемпотентный и запускается при каждом деплое; сброс демо-данных — `POST /api/v1/admin/demo/reset` под админом.
Учётки те же, что в основном README (пароль `orbi-demo-2026`), данные только синтетические.

## Локальная проверка образов

```sh
docker build -t ghcr.io/luhgeek1/avito-api:local backend
docker build -t ghcr.io/luhgeek1/avito-corpmock:local corp-mock
docker build -t ghcr.io/luhgeek1/avito-edge:local -f deploy/home/edge.Dockerfile deploy/home
docker build -t ghcr.io/luhgeek1/avito-web:local -f frontend/deploy/home/web.Dockerfile frontend
```

Дальше `docker compose up` с `IMAGE_TAG=local`, тремя `SERVICE_PASSWORD_*` и override с `ports` вне репозитория; ключ
`exclude_from_hc` понимает только Coolify, для локального запуска его нужно убрать.
