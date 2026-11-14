"""Standard-library HTTP client for local demo checks."""

import json
import threading
from http.client import HTTPConnection, HTTPSConnection, HTTPException
from urllib.parse import urlsplit


class Client:
    def __init__(self, base, token=None, timeout=30):
        target = urlsplit(base)
        if target.scheme not in {"http", "https"} or not target.hostname:
            raise ValueError("base URL must use http or https")
        self.path = target.path.rstrip("/") + "/api/v1"
        self.connection_type = (
            HTTPSConnection if target.scheme == "https" else HTTPConnection
        )
        self.host = target.hostname
        self.port = target.port
        self.connections = threading.local()
        self.token = token
        self.timeout = timeout

    def request(self, path, payload=None, *, method=None):
        headers = {
            "Content-Type": "application/json",
            "X-Client": "mobile",
            "User-Agent": "orbi-demo-check/1.0",
        }
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        body = (
            json.dumps(payload, ensure_ascii=False).encode("utf-8")
            if payload is not None
            else None
        )
        connection = getattr(self.connections, "current", None)
        if connection is None:
            connection = self.connection_type(
                self.host, self.port, timeout=self.timeout
            )
            self.connections.current = connection
        try:
            connection.request(
                method or ("POST" if body is not None else "GET"),
                self.path + path,
                body=body,
                headers=headers,
            )
            response = connection.getresponse()
            return response.status, response.read()
        except (OSError, HTTPException):
            # Never retry an ambiguous POST here. Record it and reconnect on the next call.
            self.close()
            raise

    def close(self):
        connection = getattr(self.connections, "current", None)
        if connection is not None:
            connection.close()
            self.connections.current = None

    def json(self, path, payload=None, *, method=None):
        status, body = self.request(path, payload, method=method)
        if not 200 <= status < 300:
            raise RuntimeError(f"{path}: HTTP {status}")
        return json.loads(body)

    def login(self, email, password):
        tokens = self.json("/auth/login", {"email": email, "password": password})
        self.token = tokens["access_token"]
        return self


def stream_parts(body):
    parts = []
    done = False
    for line in body.decode("utf-8").splitlines():
        if line == "data: [DONE]":
            done = True
        if line.startswith("data: ") and line != "data: [DONE]":
            part = json.loads(line[6:])
            if part.get("type") == "error":
                raise RuntimeError("Орби вернул ошибку в SSE-потоке")
            parts.append(part)
    if not parts or not done or not any(part.get("type") == "finish" for part in parts):
        raise RuntimeError("Пустой или некорректный SSE-поток")
    return parts
