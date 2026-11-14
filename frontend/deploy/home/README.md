# Деплой портала на Sara

Фронтенд выкладывается вместе с бэкендом одним стеком. Compose, nginx, workflow и инструкции:
[deploy/home/README.md](../../../deploy/home/README.md). Здесь остался только `web.Dockerfile`: Next.js standalone,
Node.js 24, порт 3000, `/healthz`; образ `ghcr.io/luhgeek1/avito-web:<sha>` запускается как сервис `site`.

Режим моков задаётся при сборке (`NEXT_PUBLIC_API_MOCKS=true` в `web.Dockerfile`). Когда фронтенд подключат к API,
уберите эту переменную: запросы пойдут на тот же домен, `/api/*` проксирует nginx.
