from typing import Any

from httpx import AsyncClient

from tests.integration.conftest import Account


async def _plan(client: AsyncClient, account: Account) -> dict[str, Any]:
    response = await client.get("/api/v1/plan", headers=account.headers)
    assert response.status_code == 200, response.text
    plan: dict[str, Any] = response.json()
    return plan


def _item(plan: dict[str, Any], slug: str) -> dict[str, Any]:
    return next(i for stage in plan["stages"] for i in stage["items"] if i["slug"] == slug)


async def test_plan_shows_stages_progress_and_next_steps(
    client: AsyncClient, anya: Account
) -> None:
    plan = await _plan(client, anya)

    assert plan["current_stage"] == "week_1"
    assert len(plan["stages"]) == 6
    assert plan["done"] == 3
    assert len(plan["next_steps"]) == 3
    stash = _item(plan, "access-stash")
    assert stash["action"] == {"kind": "access_request", "resource": "stash-listings-api"}
    quiz = _item(plan, "dev-principles")
    assert quiz["quiz"][0]["options"]
    assert "answer" not in quiz["quiz"][0]


async def test_self_confirmed_step(client: AsyncClient, anya: Account) -> None:
    item = _item(await _plan(client, anya), "learning-platform")
    url = f"/api/v1/plan/items/{item['id']}/transitions"

    started = await client.post(url, json={"transition": "start"}, headers=anya.headers)
    done = await client.post(url, json={"transition": "complete"}, headers=anya.headers)
    again = await client.post(url, json={"transition": "complete"}, headers=anya.headers)

    assert started.json()["status"] == "in_progress"
    assert done.json()["status"] == "done"
    assert again.status_code == 409
    assert again.json()["error_code"] == "PLAN_TRANSITION_INVALID"
    one = await client.get(f"/api/v1/plan/items/{item['id']}", headers=anya.headers)
    assert one.json()["completed_at"]


async def test_quiz_step(client: AsyncClient, anya: Account) -> None:
    item = _item(await _plan(client, anya), "dev-principles")
    by_hand = await client.post(
        f"/api/v1/plan/items/{item['id']}/transitions",
        json={"transition": "complete"},
        headers=anya.headers,
    )
    wrong = await client.post(
        f"/api/v1/plan/items/{item['id']}/quiz", json={"answers": [0, 1]}, headers=anya.headers
    )
    right = await client.post(
        f"/api/v1/plan/items/{item['id']}/quiz", json={"answers": [1, 1]}, headers=anya.headers
    )

    assert by_hand.json()["error_code"] == "PLAN_QUIZ_REQUIRED"
    assert wrong.json()["passed"] is False
    assert wrong.json()["wrong"] == [0]
    assert right.json()["passed"] is True
    assert right.json()["item"]["status"] == "done"


async def test_mentor_review_round_trip(client: AsyncClient, anya: Account, ivan: Account) -> None:
    item = _item(await _plan(client, anya), "goals-1on1")
    submitted = await client.post(
        f"/api/v1/plan/items/{item['id']}/transitions",
        json={"transition": "submit_review", "comment": "Цели записаны"},
        headers=anya.headers,
    )
    assert submitted.json()["waiting_reason"] == "mentor_review"
    inbox = (await client.get("/api/v1/notifications", headers=ivan.headers)).json()
    assert inbox["items"][0]["kind"] == "review_requested"

    review_url = f"/api/v1/mentees/{anya.id}/plan/items/{item['id']}/review"
    returned = await client.post(
        review_url, json={"transition": "return", "comment": "Добавь OKR"}, headers=ivan.headers
    )
    assert returned.json()["status"] == "in_progress"
    assert returned.json()["review_comment"] == "Добавь OKR"

    await client.post(
        f"/api/v1/plan/items/{item['id']}/transitions",
        json={"transition": "submit_review"},
        headers=anya.headers,
    )
    approved = await client.post(review_url, json={"transition": "approve"}, headers=ivan.headers)
    assert approved.json()["status"] == "done"
    notes = (await client.get("/api/v1/notifications", headers=anya.headers)).json()["items"]
    assert notes[0]["title"] == "Шаг подтверждён"


async def test_intern_cannot_approve_and_mentor_cannot_complete_intern_steps(
    client: AsyncClient, anya: Account, ivan: Account
) -> None:
    item = _item(await _plan(client, anya), "goals-1on1")
    await client.post(
        f"/api/v1/plan/items/{item['id']}/transitions",
        json={"transition": "submit_review"},
        headers=anya.headers,
    )

    self_approve = await client.post(
        f"/api/v1/plan/items/{item['id']}/transitions",
        json={"transition": "approve"},
        headers=anya.headers,
    )
    assert self_approve.status_code == 403

    mentor_task = _item(await _plan(client, anya), "mentor-check-access")
    done = await client.post(
        f"/api/v1/mentees/{anya.id}/plan/items/{mentor_task['id']}/review",
        json={"transition": "complete"},
        headers=ivan.headers,
    )
    assert done.json()["status"] == "done"
    intern_try = await client.post(
        f"/api/v1/plan/items/{mentor_task['id']}/transitions",
        json={"transition": "start"},
        headers=anya.headers,
    )
    assert intern_try.status_code == 403


async def test_block_notifies_the_mentor(client: AsyncClient, anya: Account, ivan: Account) -> None:
    item = _item(await _plan(client, anya), "avito-cli")
    blocked = await client.post(
        f"/api/v1/plan/items/{item['id']}/transitions",
        json={"transition": "block", "comment": "Нет прав на установку"},
        headers=anya.headers,
    )

    assert blocked.json()["blocked_reason"] == "Нет прав на установку"
    inbox = (await client.get("/api/v1/notifications", headers=ivan.headers)).json()
    assert "заблокирован" in inbox["items"][0]["title"]


async def test_other_peoples_steps_are_invisible(
    client: AsyncClient, anya: Account, dana: Account
) -> None:
    item = _item(await _plan(client, anya), "avito-cli")

    response = await client.get(f"/api/v1/plan/items/{item['id']}", headers=dana.headers)
    transition = await client.post(
        f"/api/v1/plan/items/{item['id']}/transitions",
        json={"transition": "start"},
        headers=dana.headers,
    )

    assert response.status_code == 404
    assert transition.status_code == 404
