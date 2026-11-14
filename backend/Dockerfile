# Build stage: resolve dependencies with uv from the lockfile.
FROM ghcr.io/astral-sh/uv:0.11.8-python3.13-trixie-slim AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_DEV=1 \
    UV_PYTHON_DOWNLOADS=0

WORKDIR /app

# Dependencies first: this layer is reused until uv.lock changes.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project

COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked


# Runtime stage: same Python, no uv, no build tools, non-root user.
FROM python:3.13-slim-trixie

RUN groupadd --system --gid 999 app \
 && useradd --system --gid 999 --uid 999 --no-create-home app

COPY --from=builder --chown=app:app /app /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

WORKDIR /app
USER app
EXPOSE 8080

# Migrations are a separate step (compose `migrate` service, Fly release_command),
# so several API replicas never race to migrate the same database.
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8080", \
     "--proxy-headers", "--forwarded-allow-ips", "*", "--no-access-log"]
