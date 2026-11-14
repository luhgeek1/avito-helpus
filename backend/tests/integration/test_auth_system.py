from httpx import AsyncClient

from tests.integration.conftest import ANYA, Account, login


async def test_wrong_password_is_401(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": ANYA, "password": "nope"},
        headers={"X-Client": "mobile"},
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "WRONG_CREDENTIALS"
    assert response.headers["content-type"] == "application/problem+json"


async def test_refresh_rotates_and_logout_all_kills_tokens(
    client: AsyncClient, anya: Account
) -> None:
    refreshed = await client.post(
        "/api/v1/auth/refresh", headers={"Authorization": f"Bearer {anya.refresh_token}"}
    )
    assert refreshed.status_code == 200
    reused = await client.post(
        "/api/v1/auth/refresh", headers={"Authorization": f"Bearer {anya.refresh_token}"}
    )
    assert reused.json()["error_code"] == "REFRESH_TOKEN_REUSED"

    fresh = await login(client, ANYA)
    assert (await client.post("/api/v1/auth/logout-all", headers=fresh.headers)).status_code == 204
    assert (await client.get("/api/v1/me", headers=fresh.headers)).status_code == 401


async def test_web_login_sets_cookies_and_logout_clears_them(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login", json={"email": ANYA, "password": "orbi-demo-2026"}
    )

    assert response.json()["refresh_token"] is None
    assert "refresh_token" in response.cookies
    logout = await client.post("/api/v1/auth/logout")
    assert logout.status_code == 204


async def test_requests_without_token_are_401(client: AsyncClient) -> None:
    response = await client.get("/api/v1/plan")

    assert response.status_code == 401
    assert response.json()["error_code"] == "NOT_AUTHENTICATED"


async def test_system_endpoints(client: AsyncClient) -> None:
    assert (await client.get("/api/health")).json() == {"status": "ok"}
    ready = await client.get("/api/ready")
    assert ready.json()["checks"] == {"database": "ok", "redis": "ok"}
    metrics = await client.get("/api/metrics")
    assert "buddy_http_request_seconds" in metrics.text
    missing = await client.get("/api/v1/nope")
    assert missing.status_code == 404
    assert missing.json()["request_id"]


async def test_validation_errors_use_the_problem_format(client: AsyncClient, anya: Account) -> None:
    response = await client.post(
        "/api/v1/plan/items/not-a-uuid/transitions",
        json={"transition": "fly"},
        headers=anya.headers,
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "REQUEST_VALIDATION_ERROR"


async def test_me_and_team(client: AsyncClient, anya: Account) -> None:
    me = (await client.get("/api/v1/me", headers=anya.headers)).json()
    team = (await client.get("/api/v1/team", headers=anya.headers)).json()

    assert me["internship_day"] == 3
    assert me["team"]["slug"] == "listings"
    assert "assistant:use" in me["permissions"]
    assert me["flags"]["orbi_assistant"]["enabled"] is True
    assert {p["full_name"] for p in team} >= {"Иван Петров", "Мария Ким", "Кирилл Орлов"}
