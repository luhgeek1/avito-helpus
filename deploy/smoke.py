"""Check the flagship scenario; HTTP and SSE failures always fail the smoke test."""

import os
import sys
import time
from http.client import HTTPException

from http_client import Client, stream_parts


def main():
    client = Client(os.environ.get("BASE", "http://localhost"), timeout=60).login(
        os.environ.get("EMAIL", "anya.intern@buddy.test"),
        os.environ.get("PASSWORD", "orbi-demo-2026"),
    )
    me = client.json("/me")
    print(f"Профиль: {me['full_name']}, режим: {me['assistant_mode']}")
    plan = client.json("/plan")
    print(f"План: {plan['percent']}%, следующих шагов: {len(plan['next_steps'])}")
    conversation = client.json("/chat/conversations", method="POST")
    status, body = client.request(
        f"/chat/conversations/{conversation['id']}/messages",
        {"text": "Нужен доступ к репозиторию listings-api"},
    )
    if status != 200:
        raise RuntimeError(f"Отправка сообщения: HTTP {status}")
    parts = stream_parts(body)
    actions = [p["data"]["id"] for p in parts if p.get("type") == "data-action"]
    if actions:
        status, body = client.request(
            f"/chat/conversations/{conversation['id']}/actions/{actions[-1]}",
            {"decision": "approve"},
        )
        if status != 200:
            raise RuntimeError(f"Подтверждение: HTTP {status}")
        stream_parts(body)
    else:
        preview = client.json(
            "/requests/access/preview", {"resource": "stash-listings-api"}
        )
        if preview["outcome"] == "already_granted":
            print("Доступ уже выдан: подтверждено сервисом.")
            print("OK")
            return 0
        if preview["outcome"] != "pending_exists":
            raise RuntimeError(
                "Карточка не пришла, действующего доступа или заявки нет"
            )
    deadline = time.monotonic() + 30
    while True:
        requests = client.json("/requests")
        matches = [
            r
            for r in requests
            if r["kind"] == "access"
            and r["payload"].get("resource") == "stash-listings-api"
        ]
        if not matches:
            raise RuntimeError("Заявка не сохранена")
        request = matches[0]
        if request["status"] in {"failed", "rejected", "cancelled"}:
            raise RuntimeError(f"Заявка завершилась: {request['status']}")
        if request["external_id"] and request["status"] in {"submitted", "approved"}:
            print(f"Заявка {request['external_id']}: {request['status_title']}")
            break
        if time.monotonic() >= deadline:
            raise RuntimeError(
                "За 30 секунд сервис не зарегистрировал заявку; проверьте worker"
            )
        time.sleep(1)
    print("OK")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, OSError, HTTPException, ValueError, KeyError) as exc:
        print(f"Smoke failed: {exc}", file=sys.stderr)
        sys.exit(1)
