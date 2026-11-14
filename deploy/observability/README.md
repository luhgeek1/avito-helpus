# Мониторинг и синтетический Clickstream

Профили независимы: `docker compose --profile observability up -d --build` добавляет Prometheus
и Grafana; `--profile clickstream` добавляет Kafka, создание топика и потребителя. Экспорт событий
включается отдельно: `CLICKSTREAM_ENABLED=true` в корневом `.env`, затем пересоздание API и воркера
через `docker compose --profile clickstream up -d --build`. Для обоих контуров укажите оба профиля.
Ни API, ни основной воркер не зависят от готовности брокера. Без флага новые события остаются только
в `analytics_events`; исторического backfill нет. Ранее поставленные события при выключении флага
остаются pending и возобновляют доставку после включения.

## Адреса и доступ

| Компонент | Адрес |
|---|---|
| Grafana | http://localhost:3005, папка «Орби», анонимный Viewer для локального демо |
| Prometheus | http://localhost:9095, `/targets` и `/alerts` |
| Метрики API | `http://api:8080/api/metrics` внутри Compose; nginx возвращает 404 |
| Метрики воркера | `http://worker:9100/metrics` внутри Compose; порт не опубликован |
| Kafka | `kafka:9092` внутри Compose; порт не опубликован |

Все данные синтетические. Для продакшена анонимный доступ отключается, подключаются SSO, TLS,
ACL/SASL Kafka и секрет-хранилище. Один KRaft-узел и репликация 1 — демонстрация, а не HA-кластер.
Prometheus хранит данные 7 дней; Kafka — 7 дней. SQLite и Grafana сохраняются в именованных volumes.

Миграция `c7a4e21b9d08` создаёт роль `orbi_grafana` без пароля/LOGIN и два безопасных представления.
`observability-init` создаёт случайные пароли в закрытом от хоста volume, включает LOGIN для роли.
Роль читает только `analytics_dashboard_events` и `analytics_dashboard_summary`: никаких id
сотрудников, произвольного JSON, вопросов, ответов и других текстов. Таблицы `users`, `analytics_events`,
`audit_log`, заявки и прочие таблицы роли недоступны. Миграции требуют прав CREATEROLE (в демо — postgres).
Downgrade удаляет представления и роль; после нового upgrade запустите init заново.
Администратор Grafana — `admin`; пароль при необходимости доступен владельцу локального Docker:
`docker compose exec grafana cat /run/observability/admin_password`.

## Что смотреть

Выполните `sh deploy/smoke.sh`, поиск знаний, завершение шага плана, ответ/оценку и эскалацию.
После двух scrape-интервалов появятся скорости и перцентили. При отсутствии активности панели
могут быть пустыми; счётчики событий показывают 0. Первый токен измеряется только для текстовых
ответов. Офлайн-режим без LLM-ключа сам по себе не считается фоллбэком.

«Орби — техника»: p95/p99 HTTP по шаблонам маршрутов, первый токен, исходы ходов/инструментов,
фоллбэки, вызовы corp-mock из обоих процессов, pending/failed и возраст outbox, повторы и длительности,
активные SSE, исходы и длительности AI-крона, сверки и эмбеддингов. `failed` в gauge соответствует
существующему статусу `dead`. Возраст включает отложенные повторы и dead, сбрасывается после очистки
очереди. Снимок обновляется каждые 10 с; его устаревание и недоступность scrape имеют отдельные алерты.
Метки тем и задач ограничены enum/фиксированным набором; неизвестное сворачивается в `other`.

«Орби — польза»: событийные панели фильтруются выбранным интервалом. Сводка фиксирована на последних
30 днях и использует те же источники, что API, включая сид эскалаций. Вопрос = `knowledge.search`,
доля без наставника = `1 − число эскалаций / число поисков` с округлением до 3 знаков; она не является
каузальной метрикой и может быть отрицательной. Время до доступа — среднее для одобренных заявок,
созданных за 30 дней. Шаги в срок — весь текущий план, а выполненные шаги за интервал — события,
включая повторные выполнения. Нет знаменателя — NULL. Нестандартные названия вариантов эксперимента
скрыты; разрешены a/b/control/treatment. **Синтетические данные, не доказательство пользы.**

Алерты Prometheus: фоллбэки >10%, ошибки инструментов/корпоративных сервисов, outbox старше 5 минут,
новые dead и существующий failed backlog, повторы Kafka, устаревший снимок и недоступность процессов,
p95 локальных HTTP-операций >1 с. SSE и операции с LLM/внешними сервисами исключены из порога 1 с.
Правила вычисляются в Prometheus; отправка во внешние каналы требует подключения Alertmanager.
В существующей телеметрии ассистента `outcome=info` объединяет payload с ошибкой и информационный
результат не в виде dict. Алерт инструментов учитывает `error|info` и явно называет оба случая;
по нему нужно открыть технический дашборд и проверить логи, это не точный счётчик ошибок.
Код ассистента в этой задаче не меняется. Вызовы corp-mock учитывают error/timeout/unavailable.

## Контракт и восстановление

Порт `AnalyticsPublisher` реализован адаптером aiokafka. Envelope создаётся одновременно со строкой
аналитики и сохраняется в той же транзакции в `outbox_events` с темой `analytics.publish`:

```json
{
  "schema_version": 1,
  "event_id": "00000000-0000-4000-8000-000000000001",
  "name": "answer.feedback",
  "occurred_at": "2026-11-14T12:00:00+00:00",
  "actor": "HMAC-SHA256 в hex или null для системного события",
  "properties": {"rating": "up"},
  "is_synthetic": true
}
```

Kafka key — UTF-8 `event_id`. Актор = HMAC-SHA256(secret, `orbi.analytics.v1:<user UUID>`);
секрет берётся из Settings (`CLICKSTREAM_HMAC_KEY` или `_PATH`) и хранится между перезапусками.
Ротация влияет только на новые envelope; ожидающие события неизменны. `properties` проходят
allowlist ключей **и значений** отдельно по типам событий: enum, ограниченные целочисленные счётчики
и bool. Идентификаторы сообщений/ресурсов, slug, текст, email, URL и вложенные объекты не экспортируются.

Доставка at-least-once с idempotent producer, подтверждением брокера и таймаутом обработчика 5 с.
Разрыв после публикации до DB commit может дать дубль с тем же `event_id`. Потребитель сначала
коммитит уникальный id в SQLite, затем Kafka offset; дубли не создают новые строки после рестарта.
В SQLite хранятся только event_id, имя и время; актор и properties не логируются и не сохраняются.
Неизвестная схема останавливает потребителя без commit offset: сначала устраните несовместимость.
Это **имитация формата и интеграции, не настоящий Clickstream Авито**.

Экспортёр работает отдельным циклом воркера, batch=1. Брокер не участвует в бизнес-транзакции;
ошибки доставки повторяются 2, 4, 8… с до максимума 1 ч без автоматического удаления события.
Прочие темы сохраняют прежний лимит попыток и dead-letter. При долгом отказе следите за размером БД.
Проверка отказа: остановите `kafka`, создайте активность и посмотрите очередь/повторы, затем запустите
его снова. Исторические значения счётчиков процесса обнуляются при рестарте, backlog восстанавливается
из БД. Горизонтальное масштабирование требует service discovery для scrape всех экземпляров;
дублируемые глобальные gauges backlog агрегируются через max, счётчики — sum.

## Проверки

```sh
docker compose --profile observability --profile clickstream config --quiet
docker compose --profile observability run --rm --no-deps --entrypoint promtool prometheus check config /etc/prometheus/prometheus.yml
docker compose --profile observability run --rm --no-deps --entrypoint promtool prometheus check rules /etc/prometheus/alerts.yml
cd backend
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest -q --cov=app --cov-fail-under=95
```

Интеграционные проверки используют Postgres 5439 и Redis 6380 из `docker-compose.test.yml`.
Для Windows нужен пакет tzdata; при закрытом системном temp передайте pytest
`--basetemp=.pytest-tmp-local -p no:cacheprovider`.

Опциональный тест с настоящим брокером, только при доступном Docker daemon:

```sh
cd backend
uv run --with 'testcontainers[kafka]' pytest -q -m broker tests/broker
```

По умолчанию marker `broker` исключён. Testcontainers для Python настраивает entrypoint
Confluent; тест использует пинованный `confluentinc/cp-kafka:7.6.0` в KRaft и проверяет настоящий
Kafka-протокол адаптера, JSON/key, ACK и дедупликацию. Профиль прототипа использует официальный
`apache/kafka:4.4.0`; его готовность/постоянный volume проверяются запуском Compose.

Справка библиотек: [aiokafka producer](https://aiokafka.readthedocs.io/en/stable/producer.html),
[consumer](https://aiokafka.readthedocs.io/en/stable/consumer.html),
[Prometheus Python HTTP server](https://prometheus.github.io/client_python/exporting/http/),
[Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/),
[PostgreSQL datasource](https://grafana.com/docs/grafana/latest/datasources/postgres/configure/),
[Apache Kafka Docker](https://kafka.apache.org/41/getting-started/docker/).
