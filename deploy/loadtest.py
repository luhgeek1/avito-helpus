"""Closed-loop load against the synthetic demo; uses only the Python standard library."""

import argparse
import json
import math
import random
import sys
import threading
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from http.client import HTTPException
from pathlib import Path
from urllib.parse import quote

from http_client import Client, stream_parts

ACCOUNTS = (
    "anya.intern",
    "kirill.intern",
    "dana.intern",
    "ivan.mentor",
    "maria.lead",
    "olga.hrbp",
    "admin",
    "sergey.lead",
    "pavel.mentor",
    "alexey.devops",
)
READS = {
    "GET /me": "/me",
    "GET /plan": "/plan",
    "GET /requests": "/requests",
    "GET /notifications": "/notifications",
    "GET /knowledge/search": "/knowledge/search?q=" + quote("Как скачать репозиторий?"),
}
CHAT = "POST chat message"


def percentile(values, fraction):
    ordered = sorted(values)
    return (
        round(ordered[max(0, math.ceil(len(ordered) * fraction) - 1)], 2)
        if ordered
        else None
    )


def summarize(samples):
    result = {}
    for operation, rows in sorted(samples.items()):
        successful = [
            elapsed
            for status, elapsed, failure in rows
            if 200 <= status < 300 and not failure
        ]
        values = [elapsed for _, elapsed, _ in rows]
        result[operation] = {
            "n": len(rows),
            "successful": len(successful),
            "codes": dict(
                Counter(str(status) if status else "transport" for status, _, _ in rows)
            ),
            "rate_limited": sum(status == 429 for status, _, _ in rows),
            "error_types": dict(
                Counter(str(failure) for _, _, failure in rows if failure)
            ),
            "errors": sum(
                bool(
                    failure
                    or not (200 <= status < 300 or status == 429 and operation == CHAT)
                )
                for status, _, failure in rows
            ),
            "success_ms": {
                "p50": percentile(successful, 0.50),
                "p95": percentile(successful, 0.95),
                "p99": percentile(successful, 0.99),
                "max": max(successful) if successful else None,
            },
            "all_ms": {
                "p50": percentile(values, 0.50),
                "p95": percentile(values, 0.95),
                "p99": percentile(values, 0.99),
                "max": max(values),
            },
        }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--users", type=int, default=20)
    parser.add_argument("--duration", type=float, default=60)
    parser.add_argument("--base-url", default="http://localhost")
    parser.add_argument("--password", default="orbi-demo-2026")
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--timeout", type=float, default=30)
    parser.add_argument("--actors", choices=("interns", "all"), default="interns")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.users < 1 or args.duration <= 0 or args.timeout <= 0:
        parser.error("users, duration and timeout must be positive")
    clients = [
        Client(args.base_url, timeout=args.timeout).login(
            name + "@buddy.test", args.password
        )
        for name in ACCOUNTS
    ]
    for client in clients:
        for path in READS.values():
            client.json(path)
    # Set up separate conversations sequentially: no setup exception can strand a barrier.
    actors = clients[:3] if args.actors == "interns" else clients
    users = []
    for index in range(args.users):
        client = actors[index % len(actors)]
        cid = client.json("/chat/conversations", method="POST")["id"]
        users.append((client, cid))
    samples = defaultdict(list)
    lock = threading.Lock()
    start = threading.Event()
    deadline = [0.0]

    def user(index):
        rng = random.Random(args.seed + index)
        client, conversation = users[index]
        start.wait()
        operations = [*READS, CHAT]
        while time.monotonic() < deadline[0]:
            operation = rng.choice(operations)
            started = time.perf_counter()
            status, failure = 0, False
            try:
                if operation == CHAT:
                    status, body = client.request(
                        f"/chat/conversations/{conversation}/messages",
                        {"text": "Как скачать репозиторий?"},
                    )
                    if status == 200:
                        stream_parts(body)
                else:
                    status, body = client.request(READS[operation])
                    if status == 200:
                        json.loads(body)
            except (OSError, HTTPException, ValueError, RuntimeError) as exc:
                failure = f"{type(exc).__name__}:{getattr(exc, 'winerror', None) or getattr(exc, 'errno', '')}"
            elapsed = (time.perf_counter() - started) * 1000
            with lock:
                samples[operation].append((status, elapsed, failure))
        client.close()

    with ThreadPoolExecutor(max_workers=args.users) as pool:
        futures = [pool.submit(user, i) for i in range(args.users)]
        started = time.monotonic()
        deadline[0] = started + args.duration
        start.set()
        for future in futures:
            future.result()
    for client in clients:
        client.close()
    report = {
        "base_url": args.base_url,
        "users": args.users,
        "accounts": len(ACCOUNTS),
        "active_accounts": len(actors),
        "duration_requested_sec": args.duration,
        "duration_actual_sec": round(time.monotonic() - started, 2),
        "seed": args.seed,
        "latency": "full response including SSE; milliseconds; nearest rank",
        "operations": summarize(samples),
    }
    output = json.dumps(report, ensure_ascii=False, indent=2)
    print(output)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output + "\n", encoding="utf-8")
    return int(any(row["errors"] for row in report["operations"].values()))


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"Load setup failed: {exc}", file=sys.stderr)
        sys.exit(1)
