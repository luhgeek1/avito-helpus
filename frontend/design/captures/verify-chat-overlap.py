"""Check chat hit targets with recorded synthetic API responses in a real browser."""

import json
import os
import re
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tests" / "orbi" / "fixtures"
BASE_URL = os.environ.get("PET_TEST_URL", "http://127.0.0.1:5173")
OUTPUT = ROOT / "design" / "captures"


def fixture(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def stream(name):
    return re.sub(
        r'"expires_at": "[^"]+"',
        '"expires_at": "2099-01-01T00:00:00+00:00"',
        (FIXTURES / name).read_text(encoding="utf-8"),
    )


def run():
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            sizes = [(1440, 900)] + [(w, 812) for w in (320, 375, 390, 430)] + [(812, h) for h in (320, 375, 390, 430)]
            for width, height in sizes:
                context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                context.add_init_script("""localStorage.setItem('buddy-onboarding-v1', 'done');
                    localStorage.setItem('buddy-pet', 'orbit');
                    document.cookie = 'csrf_token=synthetic; path=/';""")
                decisions = []

                def api(route):
                    path = route.request.url.split("/api/v1", 1)[1].split("?", 1)[0]
                    files = {"/me": "me-anya.json", "/plan": "plan.json", "/equipment": "equipment.json", "/notifications": "notifications.json"}
                    if path in files:
                        route.fulfill(json=fixture(files[path]))
                    elif path.startswith("/knowledge/documents/"):
                        route.fulfill(json=fixture("document.json"))
                    elif path == "/auth/refresh":
                        route.fulfill(json={"access_token": "synthetic-token", "expires_in": 900})
                    elif path == "/chat/conversations":
                        route.fulfill(json=[] if route.request.method == "GET" else {"id": "test-conv", "title": "Test", "created_at": "", "updated_at": ""})
                    elif path.endswith("/messages"):
                        route.fulfill(content_type="text/event-stream", body=stream("stream-card.txt"))
                    elif "/actions/" in path:
                        decisions.append(route.request.post_data_json)
                        route.fulfill(content_type="text/event-stream", body=stream("stream-approved.txt"))
                    elif path == "/events":
                        route.fulfill(content_type="text/event-stream", body=": test stream\n\n")
                    else:
                        route.fulfill(status=404, json={"error_code": "NOT_FOUND"})

                context.route("**/api/v1/**", api)
                page = context.new_page()
                page.goto(BASE_URL + "/plan")
                page.get_by_role("button", name="Закрыть опрос", exact=True).click()
                page.get_by_role("button", name="Спросить через Орби").click()
                chat = page.get_by_role("dialog", name="Орби", exact=True)
                chat.wait_for()
                approve = chat.get_by_role("button", name="Подтвердить", exact=True)
                approve.wait_for(state="visible")
                page.wait_for_function("!document.querySelector('#companion-chat [aria-busy=true]')")
                pet = page.locator(".widget-pet")
                pet_box = pet.bounding_box()
                # Start with an actual mouse drag while the pet is outside the chat.
                drag_x, drag_y = pet_box["x"] + pet_box["width"] / 2, pet_box["y"] + pet_box["height"] - 12
                page.mouse.move(drag_x, drag_y)
                page.mouse.down()
                page.mouse.move(drag_x - 20, drag_y - 20, steps=6)
                page.mouse.up()
                assert page.evaluate("localStorage.getItem('buddy-position') !== null"), f"Pet dragging must persist its position at {width}x{height}"

                def overlap_target(locator):
                    locator.scroll_into_view_if_needed()
                    locator.evaluate("""el => {
                        const r = el.getBoundingClientRect(), pet = document.querySelector('.companion');
                        pet.style.left = `${Math.max(8, r.right - 100)}px`;
                        pet.style.top = `${Math.max(8, r.top - 40)}px`;
                    }""")
                    return locator.evaluate("""el => {
                        const r = el.getBoundingClientRect();
                        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                        return el === hit || el.contains(hit);
                    }""")

                compact = width <= 650 or height <= 430
                if compact:
                    targets = [chat.get_by_role("textbox", name="Сообщение спутнику"), chat.get_by_role("button", name="Отправить сообщение"), approve,
                               chat.get_by_role("button", name="Изменить", exact=True), chat.get_by_role("button", name="Отменить", exact=True)]
                    for target in targets:
                        assert overlap_target(target), f"Pet blocks {target} at {width}x{height}"
                    if width == 375:
                        # The former layer order must reproduce the regression in this scenario.
                        blocker = page.add_style_tag(content=".widget-pet { z-index: 41 !important; }")
                        assert not overlap_target(approve), "The fixture must reproduce the former overlap"
                        blocker.evaluate("el => el.remove()")
                        assert overlap_target(approve)
                else:
                    assert page.locator(".widget-pet").evaluate("el => getComputedStyle(el).zIndex") == "41"
                chat.get_by_role("button", name="Изменить", exact=True).click()
                chat.get_by_role("combobox", name="Уровень").select_option("write")
                chat.get_by_role("button", name="Готово", exact=True).click()
                # Move the pet back to a free corner on desktop, whose layer order is preserved.
                if not compact:
                    pet.evaluate("el => { el.parentElement.style.left = '1200px'; el.parentElement.style.top = '740px'; }")
                approve.click()
                chat.get_by_text("Подтверждено", exact=True).wait_for()
                assert len(decisions) == 1 and decisions[0]["edits"] == {"level": "write"}
                if width in (375, 1440):
                    page.screenshot(path=str(OUTPUT / f"chat-overlap-{width}x{height}.png"))
                chat.get_by_role("button", name="Закрыть чат").click()
                instruction = page.get_by_role("button", name="Инструкция", exact=True).first
                instruction.click()
                modal = page.get_by_role("dialog", name="Принципы разработки", exact=True)
                modal.wait_for()
                close = modal.get_by_role("button", name="Закрыть", exact=True)
                assert modal.evaluate("""el => {
                    const r = document.querySelector('.widget-pet').getBoundingClientRect();
                    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                    return !hit?.closest('.companion');
                }"""), "The document modal must cover the companion"
                assert close.evaluate("el => document.activeElement === el")
                page.keyboard.press("Shift+Tab")
                assert close.evaluate("el => document.activeElement === el")
                page.keyboard.press("Tab")
                assert close.evaluate("el => document.activeElement === el")
                if width in (375, 1440):
                    page.screenshot(path=str(OUTPUT / f"document-modal-{width}x{height}.png"))
                page.keyboard.press("Escape")
                assert instruction.evaluate("el => document.activeElement === el")
                results.append({"width": width, "height": height, "hit_targets": "passed" if compact else "desktop layer preserved", "decision_count": len(decisions), "modal_keyboard": "passed"})
                context.close()
        finally:
            browser.close()
    (OUTPUT / "chat-overlap-results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    run()
