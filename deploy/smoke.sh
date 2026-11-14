#!/bin/sh
# End-to-end check of a running stack: sign in, read the plan, ask Orbi, confirm an access request.
set -eu
BASE=${BASE:-http://localhost}
API="$BASE/api/v1"
EMAIL=${EMAIL:-anya.intern@buddy.test}
PASSWORD=${PASSWORD:-orbi-demo-2026}

json() { python3 -c "import sys, json; d = json.load(sys.stdin); print($1)"; }

TOKEN=$(curl -fsS -X POST "$API/auth/login" -H 'Content-Type: application/json' -H 'X-Client: mobile' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | json "d['access_token']")
AUTH="Authorization: Bearer $TOKEN"

echo "== Профиль"
curl -fsS "$API/me" -H "$AUTH" | json "f\"{d['full_name']}, день {d['internship_day']}, наставник {d['mentor']['full_name']}, режим Орби: {d['assistant_mode']}\""
echo "== План"
curl -fsS "$API/plan" -H "$AUTH" | json "f\"{d['current_stage_title']}: {d['percent']}%, дальше: {[s['title'] for s in d['next_steps']]}\""

CID=$(curl -fsS -X POST "$API/chat/conversations" -H "$AUTH" | json "d['id']")
echo "== Орби: «Нужен доступ к репозиторию listings-api»"
ACTION=$(curl -fsSN -X POST "$API/chat/conversations/$CID/messages" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"text":"Нужен доступ к репозиторию listings-api"}' \
  | sed -n 's/^data: //p' | grep '"data-action"' | json "d['data']['id']" 2>/dev/null || true)
if [ -z "$ACTION" ]; then echo "карточка не пришла (доступ уже есть или заявка в работе)"; exit 0; fi
echo "карточка $ACTION, подтверждаю"
curl -fsSN -X POST "$API/chat/conversations/$CID/actions/$ACTION" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"decision":"approve"}' | sed -n 's/^data: //p' | grep '"data-request"' | json "f\"заявка {d['data']['external_id']}: {d['data']['status_title']}\""
echo "== Мои заявки"
curl -fsS "$API/requests" -H "$AUTH" | json "[(r['external_id'], r['status_title']) for r in d]"
echo "OK"
