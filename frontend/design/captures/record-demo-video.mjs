// Records the jury demo: an intern's request goes all the way to a saved, visible result.
// Needs a disposable local offline stack (from the repo root):
//   LLM_MODE=offline LLM_API_KEY= MOCK_APPROVAL_DELAY_SEC=8 SCHEDULER_INTERVAL_SEC=1 \
//     docker compose up -d --build --wait
// Then: node frontend/design/captures/record-demo-video.mjs [docs/demo/orbi-demo.mp4]
// The script resets the demo first, so never point it at a shared deployment.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = path.resolve(root, process.argv[2] ?? "docs/demo/orbi-demo.mp4");
const base = process.env.DEMO_BASE_URL ?? "http://localhost";
const size = { width: 1440, height: 900 };
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) {
  throw new Error("The demo recording resets data and must run against a local stack");
}

execFileSync(process.env.DEMO_PYTHON ?? "python3", ["deploy/reset_demo.py"], { cwd: root, stdio: "inherit" });
for (const probe of ["/healthz", "/api/health"]) {
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + probe)).ok) break; } catch { /* retry below */ }
    if (i > 60) throw new Error(`${probe} is not healthy`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// Caption bar, title cards and a visible cursor. They live on <html>, outside the React tree.
// The cursor and captions are manual popovers so they can be raised above modal <dialog>s.
function overlay() {
  const mount = () => {
    if (document.getElementById("demo-cursor")) return;
    const style = document.createElement("style");
    style.textContent = `
      #demo-cursor{position:fixed;inset:auto;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;padding:0;
        border-radius:50%;background:rgba(20,20,20,.28);border:2px solid #fff;box-shadow:0 0 0 1px rgba(20,20,20,.5);
        overflow:visible;pointer-events:none;transition:transform .12s ease-out;opacity:0}
      #demo-cursor.down{transform:scale(.7);background:rgba(0,170,255,.55)}
      #demo-caption{position:fixed;inset:auto;left:50%;bottom:28px;margin:0;border:0;overflow:visible;
        transform:translate(-50%,8px);max-width:880px;
        padding:14px 22px;border-radius:16px;background:rgba(20,20,20,.86);color:#fff;font:500 19px/1.4 system-ui,sans-serif;
        text-align:center;pointer-events:none;opacity:0;transition:opacity .35s ease,transform .35s ease}
      #demo-caption.on{opacity:1;transform:translate(-50%,0)}
      #demo-card{position:fixed;inset:0;z-index:2147483645;display:flex;flex-direction:column;align-items:center;
        justify-content:center;gap:18px;background:#fff;color:#141414;font:400 22px/1.45 system-ui,sans-serif;
        text-align:center;pointer-events:none;opacity:0;transition:opacity .5s ease}
      #demo-card.on{opacity:1}
      #demo-card h1{margin:0;font-size:46px;line-height:1.15;font-weight:700}
      #demo-card p{margin:0;max-width:820px;color:#5c5c5c}`;
    const cursor = Object.assign(document.createElement("div"), { id: "demo-cursor", popover: "manual" });
    const caption = Object.assign(document.createElement("div"), { id: "demo-caption", popover: "manual" });
    const card = Object.assign(document.createElement("div"), { id: "demo-card" });
    document.documentElement.append(style, card, caption, cursor);
    // Re-entering the top layer puts the overlay above dialogs opened since the last call.
    window.__demoRaise = () => { for (const node of [caption, cursor]) { node.hidePopover(); node.showPopover(); } };
    window.__demoRaise();
    addEventListener("mousemove", (e) => {
      cursor.style.opacity = "1"; cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`;
    }, true);
    addEventListener("mousedown", () => cursor.classList.add("down"), true);
    addEventListener("mouseup", () => cursor.classList.remove("down"), true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
}

const browser = await chromium.launch();
const videoDir = mkdtempSync(path.join(tmpdir(), "orbi-demo-"));
const context = await browser.newContext({ viewport: size, recordVideo: { dir: videoDir, size }, locale: "ru-RU" });
await context.addInitScript(overlay);
const page = await context.newPage();

const pause = (ms) => page.waitForTimeout(ms);
async function caption(text, hold = 0) {
  await page.evaluate((value) => {
    const node = document.getElementById("demo-caption");
    if (!node) return;
    window.__demoRaise();
    node.classList.remove("on");
    setTimeout(() => { node.textContent = value; if (value) node.classList.add("on"); }, value ? 200 : 0);
  }, text);
  if (hold) await pause(hold);
}
async function card(title, text, hold, { last = false } = {}) {
  await page.evaluate(([heading, body]) => {
    const node = document.getElementById("demo-card");
    document.getElementById("demo-cursor")?.style.setProperty("opacity", "0");
    node.innerHTML = "";
    const h1 = document.createElement("h1"); h1.textContent = heading;
    const p = document.createElement("p"); p.textContent = body;
    node.append(h1, p); node.classList.add("on");
  }, [title, text]);
  await pause(hold);
  if (last) return;
  await page.evaluate(() => document.getElementById("demo-card").classList.remove("on"));
  await pause(600);
}
let mouse = { x: size.width / 2, y: size.height / 2 };
async function point(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no box");
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.evaluate(() => window.__demoRaise?.());
  await page.mouse.move(target.x, target.y, { steps: Math.max(12, Math.round(Math.hypot(target.x - mouse.x, target.y - mouse.y) / 18)) });
  mouse = target;
  await pause(250);
}
async function click(locator) {
  await point(locator);
  await locator.click();
}
async function type(locator, text) {
  await click(locator);
  await locator.pressSequentially(text, { delay: 55 });
  await pause(400);
}
async function center(locator) {
  await locator.evaluate((element) => element.scrollIntoView({ behavior: "smooth", block: "center" }));
  await pause(900);
}
async function ask(chat, text) {
  await type(chat.getByRole("textbox", { name: "Сообщение спутнику" }), text);
  await click(chat.getByRole("button", { name: "Отправить сообщение" }));
}

// 1. Title and sign-in. The title is its own page: the onboarding dialog opens on top of /login.
await page.setContent("<!doctype html><html><body></body></html>");
if (!(await page.locator("#demo-card").count())) await page.evaluate(overlay);
await card("Орби — AI-buddy для стажёров Авито",
  "Путь от запроса до результата: план адаптации, заявка через корпоративный сервис, ответы с источниками, отгул", 4500);
await page.goto(`${base}/login`);
const tour = page.getByRole("dialog", { name: "Знакомство с петом" });
await tour.waitFor();
await caption("При первом входе Орби коротко знакомит стажёра с собой", 3500);
await click(tour.getByRole("button", { name: "Пропустить", exact: true }));
await caption("Вход через имитацию корпоративного SSO: стажёрка Аня, 3-й день", 1600);
await click(page.getByRole("region", { name: "Войти как" }).getByRole("button", { name: /Аня Смирнова/ }));

// 2. The adaptation plan with statuses and next steps.
await page.waitForURL(/\/plan$/);
await page.getByRole("heading", { name: "Мой путь", exact: true }).waitFor();
const survey = page.getByRole("button", { name: "Закрыть опрос" });
if (await survey.count()) await click(survey);
await caption("«Мой путь»: этапы из чек-листа Авито, статусы, прогресс и следующие шаги", 4500);
const stepTitle = "Получи доступ к репозиторию listings-api";
const step = page.getByRole("region", { name: "Весь план", exact: true })
  .getByRole("listitem").filter({ has: page.getByRole("heading", { name: stepTitle, exact: true }) });
await center(step);
await caption("Чтобы взять первую задачу, нужен доступ к репозиторию — делаем это с Орби", 2500);

// 3. The flagship action: an access request through the corporate service imitation.
await click(step.getByRole("button", { name: "Сделать с Орби", exact: true }));
const chat = page.getByRole("dialog", { name: "Орби", exact: true });
const access = chat.getByRole("region", { name: /Заявка на доступ:.*listings-api/ });
await access.waitFor();
await caption("Орби подбирает ресурс, уровень и согласующего — и ждёт подтверждения стажёра", 2000);
for (const field of await access.locator("dd").all()) await point(field);
await pause(1500);
await click(access.getByRole("button", { name: "Подтвердить", exact: true }));
await access.getByText("Подтверждено", { exact: true }).waitFor();
await caption("Заявка ушла в сервис доступов через MCP; ответ сервиса сохранён", 3500);
await click(chat.getByRole("button", { name: "Закрыть чат", exact: true }));
await click(page.getByRole("link", { name: "Заявки", exact: true }));
const request = page.getByRole("listitem").filter({ hasText: "ACC-1042" });
await request.waitFor();
await point(request);
await caption("«Мои заявки»: ACC-1042 на согласовании у руководителя команды", 4000);

// 4. The approver decides; the webhook closes the plan step.
await click(page.getByRole("link", { name: "Мой путь", exact: true }));
await center(step);
await caption("Согласующий одобряет заявку, веб-хук сервиса закрывает шаг плана…", 0);
await step.getByText("Готово", { exact: true }).waitFor({ timeout: 90_000 });
await point(step);
await caption("Шаг выполнен, прогресс плана вырос", 3200);
await click(page.getByRole("button", { name: /^Уведомления/ }));
const notices = page.getByRole("dialog", { name: "Уведомления", exact: true });
await point(notices.getByRole("link").filter({ hasText: /listings-api.*одобрено/ }));
await caption("Орби сообщает результат и подсказывает следующий шаг", 3800);
await page.keyboard.press("Escape");
await click(page.getByRole("link", { name: "Заявки", exact: true }));
await request.getByText(/Одобрено/).waitFor();
await point(request);
await caption("Итог сохранён: заявка одобрена", 3000);

// 5. Questions about the team and tools, with sources and conflicts.
await click(page.getByRole("button", { name: "Чат", exact: true }));
await chat.waitFor();
await caption("Вопросы о команде и инструментах — ответы со ссылками на источники", 800);
await ask(chat, "Куда отправлять PR?");
await chat.getByText("Источники", { exact: true }).waitFor();
const conflict = chat.getByRole("note").last();
await conflict.waitFor();
await center(conflict);
await caption("Гайд команды расходится с общим регламентом — Орби показывает обе цитаты и предлагает уточнить у наставника", 6000);

// 6. Rights: hidden resources are never disclosed.
await caption("Права учитываются: закрытые ресурсы не раскрываются и не запрашиваются", 600);
await ask(chat, "Нужен доступ к продовой базе");
await pause(4500);

// 7. The case's own example: a day off through the absence service.
await caption("Отгул: Орби проверяет остаток дней и календарь, предупреждает о встречах", 600);
await ask(chat, "Хочу отгул в пятницу");
const absence = chat.getByRole("region", { name: /Заявка: Отгул/ });
await absence.waitFor();
for (const field of await absence.locator("dd").all()) await point(field);
await pause(1200);
await click(absence.getByRole("button", { name: "Подтвердить", exact: true }));
await absence.getByText("Подтверждено", { exact: true }).waitFor();
await caption("Заявка ушла в сервис отсутствий и сохранена в «Моих заявках»", 2500);
await click(chat.getByRole("button", { name: "Закрыть чат", exact: true }));
await page.getByRole("listitem").filter({ hasText: /Отгул/ }).first().waitFor();
await point(page.getByRole("listitem").filter({ hasText: /Отгул/ }).first());
await pause(3500);

await caption("", 0);
await card("Орби экономит время наставника",
  "Рутинные вопросы и оформление заявок — на Орби; содержательная работа — у людей. Все данные синтетические", 4500,
  { last: true });

const video = page.video();
await context.close();
await browser.close();
const webm = await video.path();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-preset", "slow", "-crf", "24",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", output], { stdio: "inherit" });
for (const file of readdirSync(videoDir)) rmSync(path.join(videoDir, file));
rmSync(videoDir, { recursive: true });
console.log(`Saved ${path.relative(root, output)}`);
