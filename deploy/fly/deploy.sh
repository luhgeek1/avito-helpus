#!/usr/bin/env bash
# Deploys the whole Orbi stand to Fly.io: db, redis, corp-mock, api (+worker), site, public edge.
#   deploy/fly/deploy.sh <image-sha> [secrets-dir]
# First run only: secrets-dir holds pg, csrf, webhook, jwt_private_key.pem, jwt_public_key.pem, and
# LLM_API_KEY is read from the environment; db and redis are deployed then too. Later runs (CI, new
# images only) omit secrets-dir and update corp-mock, api, site and the edge.
set -euo pipefail
cd "$(dirname "$0")"
SHA=${1:?image sha}
SECRETS=${2:-}
ORG=${FLY_ORG:-personal}
REGION=fra
REG=ghcr.io/luhgeek1

ensure_app() { fly apps list --json | grep -q "\"Name\": *\"$1\"" || fly apps create "$1" --org "$ORG"; }

for app in avito-orbi-db avito-orbi-redis avito-orbi-corp avito-orbi-api avito-orbi-site avito-orbi; do
  ensure_app "$app"
done

if [[ -n "$SECRETS" ]]; then
  PG=$(cat "$SECRETS/pg"); WEBHOOK=$(cat "$SECRETS/webhook")
  fly volumes list -a avito-orbi-db --json | grep -q '"pgdata"' ||
    fly volumes create pgdata -a avito-orbi-db -r "$REGION" -s 3 -y
  fly secrets set -a avito-orbi-db --stage POSTGRES_PASSWORD="$PG"
  fly secrets set -a avito-orbi-corp --stage CORP_WEBHOOK_SECRET="$WEBHOOK"
  fly secrets set -a avito-orbi-api --stage \
    DATABASE_URL="postgresql+asyncpg://postgres:$PG@avito-orbi-db.internal:5432/buddy" \
    CSRF_HMAC_KEY="$(cat "$SECRETS/csrf")" CORP_WEBHOOK_SECRET="$WEBHOOK" \
    JWT_PRIVATE_KEY="$(cat "$SECRETS/jwt_private_key.pem")" \
    JWT_PUBLIC_KEY="$(cat "$SECRETS/jwt_public_key.pem")" \
    LLM_API_KEY="${LLM_API_KEY:?LLM_API_KEY}"
fi

deploy() { fly deploy -c "$1" --ha=false --yes "${@:2}"; }
if [[ -n "$SECRETS" ]]; then
  deploy db.toml
  deploy redis.toml
fi
deploy corp.toml --image "$REG/avito-corpmock:$SHA"
deploy api.toml --image "$REG/avito-api:$SHA"
deploy site.toml --image "$REG/avito-web:$SHA"
deploy edge.toml
fly certs list -a avito-orbi | grep -q avito.prooood.ru || fly certs add avito.prooood.ru -a avito-orbi
