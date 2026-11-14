from httpx import AsyncClient

from tests.integration.conftest import Account


async def test_seeded_intern_can_sign_in(client: AsyncClient, anya: Account) -> None:
    me = await client.get("/api/v1/me", headers=anya.headers)

    assert me.json()["full_name"] == "Аня Смирнова"
    assert me.json()["mentor"]["full_name"] == "Иван Петров"
    assert me.json()["assistant_mode"] == "offline"
