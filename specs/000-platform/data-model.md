# Модель данных

PostgreSQL 17 + pgvector. Все таблицы с UUID-ключами и `created_at`/`updated_at` (UTC), если не
сказано иное. Перечисления хранятся как Postgres enum.

| Таблица | Ключевые поля | Назначение |
|---|---|---|
| `teams` | `slug`, `name`, `description`, `channel`, `lead_id` | команды (ABAC по команде) |
| `users` | `email`, `password_hash`, `full_name`, `title`, `role` (`intern/mentor/lead/hrbp/admin`), `team_id`, `mentor_id`, `lead_id`, `hrbp_id`, `start_date`, `track`, `auth_version` | сотрудники и связи |
| `auth_sessions` | из шаблона | refresh-сессии |
| `outbox_events` | из шаблона | побочные эффекты после коммита |
| `plan_template_items` | `slug`, `stage`, `position`, `title`, `description`, `category`, `confirmation` (`self/quiz/mentor`), `action` (JSONB), `quiz` (JSONB), `doc_slugs`, `needs_laptop`, `track`, `audience` (`intern/mentor`) | шаблон плана из чек-листа |
| `plan_items` | `user_id`, `template_item_id`, `status`, `due_date`, `started_at`, `completed_at`, `waiting_reason`, `blocked_reason`, `request_id`, `confirmed_by_id`, `review_comment` | план конкретного стажёра |
| `access_resources` | `slug`, `name`, `system`, `description`, `team_id`, `sensitivity` (`standard/restricted/confidential`), `approver_role`, `default_level`, `aliases` | каталог ресурсов (видимость по ABAC) |
| `service_requests` | `user_id`, `kind` (`access/absence/equipment`), `status`, `external_id`, `title`, `payload` (JSONB), `approver`, `plan_item_id`, `idempotency_key` (unique), `decision_comment`, `sla_due_at`, `last_reminded_at` | заявки в корпоративные сервисы |
| `request_events` | `request_id`, `status`, `source` (`user/agent/worker/webhook`), `note` | история статусов |
| `kb_documents` | `slug`, `title`, `kind`, `scope` (`company/team`), `team_id`, `roles` (массив), `owner`, `source_label`, `source_url`, `doc_updated_at`, `body` | документы базы знаний |
| `kb_chunks` | `document_id`, `position`, `heading`, `content`, `topic`, `search_vector` (tsvector, generated), `embedding` (vector 1024) | разделы для поиска |
| `kb_conflicts` | `topic`, `company_chunk_id`, `team_chunk_id`, `summary`, `status`, `detected_by` | противоречия источников |
| `escalations` | `user_id`, `assignee_id`, `level` (`mentor/lead/hrbp`), `kind`, `status`, `question`, `context` (JSONB), `answer`, `answered_by_id`, `due_at`, `faq_document_id`, `conversation_id` | вопросы людям |
| `notifications` | `user_id`, `kind`, `title`, `body`, `link`, `payload`, `dedupe_key`, `read_at` | уведомления (уникальность `user_id + dedupe_key`) |
| `conversations` | `user_id`, `title`, `model_history` (JSONB, сообщения Pydantic AI), `mode` | диалоги |
| `chat_messages` | `conversation_id`, `role`, `parts` (JSONB, формат UI), `feedback`, `feedback_comment` | сообщения для отображения |
| `pending_actions` | `conversation_id`, `user_id`, `tool_call_id`, `tool_name`, `args`, `card` (JSONB), `status` (`pending/approved/rejected/expired`), `expires_at`, `decided_at` | карточки подтверждения |
| `analytics_events` | `user_id`, `name`, `properties` (JSONB), `variant` | продуктовая аналитика |
| `audit_log` | `actor_id`, `action`, `target_type`, `target_id`, `details` (JSONB) | аудит решений и действий |
| `feature_flags` | `key` (PK), `enabled`, `rollout_percent`, `variants` (JSONB), `description` | флаги и эксперименты |

## Жизненные циклы

```text
plan_items:        todo → in_progress → done
                   todo|in_progress → waiting (заявка или ревью наставника) → done | in_progress
                   todo|in_progress → blocked → in_progress
service_requests:  submitting → submitted → approved | rejected | cancelled
                   submitting → failed
escalations:       open (mentor) → open (lead) → open (hrbp) → answered → closed
                   open → closed
pending_actions:   pending → approved | rejected | expired
```
