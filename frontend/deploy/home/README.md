# Деплой фронтенда на Sara

Адрес: **https://avito.prooood.ru**. DNS: `avito CNAME home.prooood.ru`.
Размещается только демонстрационный фронтенд с моками. Backend, база и внешние API не запускаются.

## Устройство

- Next.js standalone, Node.js 24, порт 3000 внутри контейнера, пользователь `node`.
- Образ: `ghcr.io/luhgeek1/avito-web:<полный SHA коммита>`, платформа `linux/amd64`.
- Coolify Service: `f87xwad3ydhgmn7ya4wrubos`, проект `avito`.
- Compose: `docker-compose.yml` рядом с этим документом. Без опубликованных портов, лимит памяти 384 МБ.
- HTTPS и маршрутизация — общий Traefik, управляемый Coolify. Панель остаётся приватной.
- `/healthz` возвращает `{"status":"ok"}`. Проверка контейнера проверяет HTTP и содержимое ответа.
- Режим моков задаётся при сборке (`NEXT_PUBLIC_API_MOCKS=true`). Это публичные демонстрационные данные; авторизации пока нет.

Используется standalone, потому что текущие динамические маршруты и серверный `searchParams` галереи требуют Next.js runtime. В образ копируются `public`, `.next/static` и зависимости из `.next/standalone`; исходники дизайна и секреты исключены из build context.

## Локальная проверка

Из корня репозитория:

```sh
docker build --platform linux/amd64 -f frontend/deploy/home/web.Dockerfile \
  -t ghcr.io/luhgeek1/avito-web:local frontend
```

Создай временный override **за пределами репозитория**:

```yaml
services:
  web:
    ports:
      - "127.0.0.1:5180:3000"
```

```sh
IMAGE_TAG=local docker compose -p avito-local \
  -f frontend/deploy/home/docker-compose.yml -f /tmp/avito-local.yml up -d --wait
curl --fail http://127.0.0.1:5180/healthz
curl --fail 'http://127.0.0.1:5180/pets?pet=orbit' >/dev/null
```

Открой главную и галерею на десктопе и телефоне. После проверки выполни ту же compose-команду с `down` вместо `up -d --wait`.

## GitHub Actions

Workflow: `.github/workflows/deploy-home.yml` в корне репозитория.

1. Push в `main` или `deploy/home-server`, затрагивающий `frontend/**` или workflow, запускает TypeScript, тесты, Steiger и Docker build.
2. Образ публикуется в GHCR с тегом SHA. Ветка `deploy/home-server` только собирается.
3. Только `main` запускает деплой: Tailscale → SSH с pinned host key → `avito <sha>` → ожидание healthy.
4. Проверяются публичные HTTPS `/healthz` и `/pets?pet=orbit`. `workflow_dispatch` позволяет повторить процесс; для выкладки выбери `main`.

Repository secrets:

| Имя | Источник на сервере |
| --- | --- |
| `SARA_DEPLOY_KEY` | `~/.config/sara-ci/keys/github-ci-avito` |
| `TS_OAUTH_CLIENT_ID` | `~/.config/sara-ci/ts-client-id` |
| `TS_OAUTH_SECRET` | `~/.config/sara-ci/ts-secret` |

Repository variables: `SARA_TAILSCALE_IP=100.77.242.59`, `SARA_HOST_KEY` (публичный pinned ключ из `~/.config/sara-ci/host-key`), `AVITO_HOST=avito.prooood.ru`.

Повторно получить команды настройки: `ssh sara 'sara-onboard ci avito luhgeek1/avito-helpus'`. При использовании локального доступа владельца вместо `ssh sara`:

```sh
ssh -F /Users/laughinme/Code/python/sara-hosting/outputs/ssh_config sara-server 'sara-app status avito'
```

Сервер должен иметь доступ к GHCR-пакету. Публичность репозитория сама по себе не гарантирует публичность нового пакета: проверь package settings после первой сборки. Можно сделать пакет public либо дать серверному аккаунту `laughinme` Read.

## Обновление и откат

Обычные изменения фронтенда выкладываются после push в `main`.
Изменения Compose нужно отдельно применить на сервере (workflow не меняет конфигурацию Coolify):

```sh
ssh sara 'sara-app compose-put avito' < frontend/deploy/home/docker-compose.yml
ssh sara 'sara-deploy avito <sha-с-готовым-образом>'
```

Для отката используй предыдущий успешный SHA с доступным образом. Состояние и логи:

```sh
ssh sara 'sara-app status avito'
ssh sara 'sara-app logs avito web 100'
```

Выбор пета, избранное и переписка сохраняются в браузере. Пересоздание контейнера их не удаляет; новый домен получает отдельное localStorage.
