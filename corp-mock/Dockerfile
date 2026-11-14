# Imitation of corporate services (MCP over streamable HTTP). Not part of the product code.
FROM ghcr.io/astral-sh/uv:0.11.8-python3.13-trixie-slim AS builder

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_NO_DEV=1 UV_PYTHON_DOWNLOADS=0
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project
COPY . /app

FROM python:3.13-slim-trixie
RUN groupadd --system --gid 999 app && useradd --system --gid 999 --uid 999 --no-create-home app
COPY --from=builder --chown=app:app /app /app
# Tickets and grants survive restarts in a volume mounted here (it inherits this owner).
RUN mkdir -p /data && chown app:app /data
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
WORKDIR /app
USER app
EXPOSE 8090
HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8090/health')"
CMD ["uvicorn", "corp_mock.server:app", "--host", "0.0.0.0", "--port", "8090"]
