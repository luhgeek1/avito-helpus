.DEFAULT_GOAL := help
.PHONY: help up down logs ps reset-demo env keys install run worker corp-mock lint fmt typecheck \
	test test-deps test-down coverage check migrate migration openapi smoke frontend-dev frontend-test

BACKEND := backend
UV := cd $(BACKEND) && uv run
TEST_COMPOSE := docker compose -p buddy-test -f docker-compose.test.yml

help: ## Show this help
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# --- whole stack (what the jury runs) -------------------------------------------------------

up: ## Build and start everything: http://localhost (API docs: /api/docs)
	@test -f .env || cp .env.example .env
	docker compose up -d --build

down: ## Stop the stack (data is kept)
	docker compose down --remove-orphans

logs: ## Follow logs
	docker compose logs -f --tail=200

ps: ## Containers and their health
	docker compose ps

reset-demo: ## Restore the demo company and the corp-mock state
	docker compose exec api python -m app.cli seed --reset
	curl -fsS -X POST http://localhost:8090/admin/reset >/dev/null && echo "corp-mock reset"

smoke: ## End-to-end check of a running stack (login, plan, chat, access request)
	sh deploy/smoke.sh

# --- backend development --------------------------------------------------------------------

install: ## Install backend and frontend dependencies
	cd $(BACKEND) && uv sync
	cd corp-mock && uv sync
	npm --prefix frontend ci

env: ## Create backend/.env from the example (never overwrites)
	@test -f $(BACKEND)/.env || (cp $(BACKEND)/.env.example $(BACKEND)/.env && echo "created backend/.env")

keys: ## Generate JWT keys into backend/secrets (never overwrites)
	$(UV) python -m app.cli keys

run: env keys ## API with reload on :8080 (needs Postgres/Redis, e.g. `make test-deps`)
	$(UV) uvicorn app.main:create_app --factory --reload --port 8080

worker: ## Outbox and AI-cron worker
	$(UV) python -m app.worker

corp-mock: ## Corporate services imitation on :8090
	cd corp-mock && MOCK_APPROVAL_DELAY_SEC=5 uv run uvicorn corp_mock.server:app --port 8090

migrate: ## Apply migrations to the database from backend/.env
	$(UV) alembic upgrade head

migration: ## New migration from model changes: make migration m="add x"
	@test -n "$(m)" || (echo 'usage: make migration m="what changed"' && exit 1)
	$(UV) alembic revision --autogenerate -m "$(m)"

openapi: ## Export the OpenAPI schema to docs/api/openapi.json
	@mkdir -p docs/api
	$(UV) python -c "import json; from app.main import create_app; print(json.dumps(create_app().openapi(), indent=2, ensure_ascii=False))" > docs/api/openapi.json

# --- quality ----------------------------------------------------------------------------------

lint: ## Ruff lint and format check
	$(UV) ruff check .
	$(UV) ruff format --check .

fmt: ## Format and autofix
	$(UV) ruff format .
	$(UV) ruff check --fix .

typecheck: ## mypy --strict
	$(UV) mypy

test-deps: ## Throwaway Postgres (pgvector) and Redis for tests on ports 5439/6380
	$(TEST_COMPOSE) up -d --wait

test-down: ## Remove the test containers
	$(TEST_COMPOSE) down -v

test: test-deps ## Backend tests
	$(UV) pytest -q

coverage: test-deps ## Backend + frontend coverage, then the combined report in reports/
	@mkdir -p reports
	$(UV) pytest -q --cov=app --cov-report=term --cov-report=xml:../reports/backend-coverage.xml --cov-report=lcov:../reports/backend.lcov
	npm --prefix frontend run coverage
	python3 deploy/coverage_report.py

check: lint typecheck test ## Everything CI runs for the backend

frontend-dev: ## Next.js dev server on :5173
	npm --prefix frontend run dev

frontend-test: ## Frontend tests
	npm --prefix frontend test
