# Стенд на Fly.io

Адрес: **https://avito.prooood.ru** (запасной `https://avito-orbi.fly.dev`). Регион `fra`, организация `personal`.
Переехали с домашнего сервера 16.11.2026 (D-050): там OpenAI доступен только через VPN роутера, а он упал.

| Приложение | Что | Доступ |
|---|---|---|
| `avito-orbi` | nginx: `/` → портал, `/api` → Орби ([nginx.conf](nginx.conf)) | публичный, TLS у Fly |
| `avito-orbi-api` | API (`app`) и воркер (`worker`); миграции и сид в `release_command` | `avito-orbi-api.internal:8080` |
| `avito-orbi-site` | портал Next.js | `avito-orbi-site.internal:3000` |
| `avito-orbi-corp` | corp-mock (MCP), заявки на томе `corp_state` | `avito-orbi-corp.internal:8090` |
| `avito-orbi-db` | Postgres 17 + pgvector, том `pgdata` 3 ГБ | `avito-orbi-db.internal:5432` |
| `avito-orbi-redis` | Redis без сохранения на диск | `avito-orbi-redis.internal:6379` |

Приложения общаются по приватной сети Fly (IPv6), поэтому uvicorn, Next.js и Redis слушают `::`.
Образы те же, что собирает CI: `ghcr.io/luhgeek1/avito-{api,corpmock,web}:<sha>`.

## Деплой

Каждый push в `main` выкатывает новый SHA job'ом `deploy-fly` в
[deploy-home.yml](../../.github/workflows/deploy-home.yml) (секрет `FLY_API_TOKEN`, org-токен).
Вручную:

```sh
deploy/fly/deploy.sh <sha>                          # corp-mock, api, site, edge
LLM_API_KEY=... deploy/fly/deploy.sh <sha> <dir>    # первичная настройка: секреты, том, db, redis
```

В `<dir>` лежат `pg`, `csrf`, `webhook`, `jwt_private_key.pem`, `jwt_public_key.pem`
(ключи: `python -m app.cli keys --dir <dir>`).

## Эксплуатация

```sh
fly logs -a avito-orbi-api
fly status -a avito-orbi-api
fly secrets set -a avito-orbi-api LLM_MODEL=...
fly deploy -c deploy/fly/api.toml --image ghcr.io/luhgeek1/avito-api:<предыдущий-sha>   # откат
```

DNS в рег.ру: для `avito` записи `A 66.241.124.16` и `AAAA 2a09:8280:1::209:7de7:0`, сертификат —
`fly certs check avito.prooood.ru -a avito-orbi`.
Сброс демо: кнопка «Сбросить демо» в `/demo` или `POST /api/v1/demo/reset`.
