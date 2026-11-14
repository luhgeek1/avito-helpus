import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { createPortalQueryClient } from "@/_app/model/portal-provider";
import { LoginPage, MentorPage, PlanPage, RequestsPage, orbiPhrase } from "@/_pages/orbi";
import { useOrbiChat } from "@/features/orbi-chat";
import { useSession } from "@/shared/api";
import type { PlanItem, ServiceRequest } from "@/shared/api";
import { PortalShell } from "@/widgets/portal-shell";
import { server } from "../portal/setup";
import { history, resetNavigation, useLocation } from "../portal/navigation";
import { fixture, problem, signIn, url } from "./server";

function Pages() {
  const { pathname, searchParams } = useLocation();
  const [, first, second, third] = pathname.split("/");
  let page;
  if (first === "login") page = <LoginPage next={searchParams.get("next") ?? undefined} />;
  else if (first === "plan") page = <PlanPage highlight={searchParams.get("item") ?? undefined} />;
  else if (first === "requests") page = <RequestsPage tab="requests" selected={second} />;
  else if (first === "questions") page = <RequestsPage tab="questions" selected={second} />;
  else if (first === "mentor") page = <MentorPage mentee={second === "mentees" ? third : undefined} question={second === "questions" ? third : undefined} />;
  else page = <p>Главная</p>;
  return <PortalShell>{page}</PortalShell>;
}

function renderAt(path: string) {
  resetNavigation(path);
  const user = userEvent.setup();
  render(<QueryClientProvider client={createPortalQueryClient()}><Pages /></QueryClientProvider>);
  return { user };
}

type Plan = { next_steps: PlanItem[]; stages: { items: PlanItem[] }[] };
const plan = () => fixture<Plan>("plan.json");
const step = (title: RegExp) => screen.getAllByRole("heading", { level: 4, name: title })[0].closest("li") as HTMLElement;

describe("sign-in", () => {
  it("signs a demo intern in and opens their path", async () => {
    const { user } = renderAt("/login");
    await user.click(screen.getByRole("button", { name: /Аня Смирнова/ }));
    await waitFor(() => expect(history.location.pathname).toBe("/plan"));
    expect(useSession.getState().status).toBe("authenticated");
  });

  it("sends a mentor to the mentees screen and respects ?next", async () => {
    const { user } = renderAt("/login");
    await user.click(screen.getByRole("button", { name: /^Иван Петров/ }));
    await waitFor(() => expect(history.location.pathname).toBe("/mentor"));
    renderAt("/login?next=/requests");
    await waitFor(() => expect(history.location.pathname).toBe("/requests"));
  });

  it("explains a wrong password and an unreachable backend", async () => {
    const { user } = renderAt("/login");
    await user.type(screen.getByLabelText("Рабочая почта"), "anya.intern@buddy.test");
    await user.type(screen.getByLabelText("Пароль"), "nope");
    await user.click(screen.getByRole("button", { name: "Войти" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Неверная почта или пароль");
    server.use(http.post(url("/auth/login"), () => HttpResponse.error()));
    await user.click(screen.getByRole("button", { name: "Войти" }));
    expect(await screen.findByText(/Сервер Орби недоступен/)).toBeInTheDocument();
    server.use(http.post(url("/auth/login"), () => problem(429, "RATE_LIMITED")));
    await user.click(screen.getByRole("button", { name: "Войти" }));
    expect(await screen.findByText(/Слишком много попыток/)).toBeInTheDocument();
  });
});

describe("my path", () => {
  it("asks to sign in first", () => {
    useSession.setState({ status: "anonymous" });
    renderAt("/plan");
    expect(within(screen.getByRole("main")).getByRole("link", { name: "Войти" })).toHaveAttribute("href", "/login");
    expect(screen.getByText(/Раздел работает с твоими данными/)).toBeInTheDocument();
  });

  it("shows progress, next steps, the laptop and the current stage", async () => {
    signIn();
    renderAt("/plan");
    expect(await screen.findByRole("heading", { name: "Мой путь" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Прогресс плана адаптации" })).toHaveAttribute("aria-valuenow", String(fixture<{ percent: number }>("plan.json").percent));
    expect(screen.getByText("Иван Петров")).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Ноутбук" })).toHaveTextContent("MacBook Pro 14");
    expect(within(screen.getByRole("region", { name: "Сейчас важно" })).getAllByRole("listitem")).toHaveLength(plan().next_steps.length);
    expect(screen.getByRole("button", { name: /Вторая неделя/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("moves a step forward and reports a blocker", async () => {
    signIn();
    const calls: unknown[] = [];
    server.use(http.post(url("/plan/items/:id/transitions"), async ({ request, params }) => {
      const body = await request.json() as { transition: string };
      calls.push({ id: params.id, ...body });
      if (body.transition === "complete") return problem(409, "PLAN_TRANSITION_INVALID");
      return HttpResponse.json(plan().next_steps[0]);
    }));
    const { user } = renderAt("/plan");
    await screen.findByRole("heading", { name: "Мой путь" });
    const jira = step(/Jira-проекту/);
    await user.click(within(jira).getByRole("button", { name: "Начать" }));
    await user.click(within(jira).getByRole("button", { name: "Готово" }));
    expect(await within(jira).findByRole("alert")).toHaveTextContent("Статус шага уже изменился");
    await user.click(within(jira).getByRole("button", { name: "Есть блокер" }));
    await user.type(within(jira).getByRole("textbox", { name: "Что мешает" }), "Нет ответа от Jira");
    await user.click(within(jira).getByRole("button", { name: "Сообщить" }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ transition: "block", comment: "Нет ответа от Jira" }));
    expect(calls.map((call) => (call as { transition: string }).transition)).toEqual(["start", "complete", "block"]);
  });

  it("does a step with Orbi and opens an instruction", async () => {
    signIn();
    const { user } = renderAt("/plan");
    await screen.findByRole("heading", { name: "Мой путь" });
    await user.click(within(step(/Jira-проекту/)).getByRole("button", { name: "Сделать с Орби" }));
    expect(useOrbiChat.getState().openSignal).toBe(1);
    expect(useOrbiChat.getState().messages[0].parts[0]).toMatchObject({ text: expect.stringContaining("jira-listings") });
    await user.click(within(step(/Jira-проекту/)).getByRole("button", { name: "Инструкция" }));
    expect(await screen.findByRole("dialog", { name: "Принципы разработки" })).toBeInTheDocument();
    expect(screen.getByText(/обновлено/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Закрыть" }));
  });

  it("runs the quiz until it passes", async () => {
    signIn();
    let attempt = 0;
    server.use(http.post(url("/plan/items/:id/quiz"), () => {
      attempt += 1;
      const item = plan().stages[0].items.find((entry) => entry.confirmation === "quiz");
      return HttpResponse.json({ passed: attempt > 1, wrong: attempt > 1 ? [] : [0], item });
    }));
    const { user } = renderAt("/plan");
    await screen.findByRole("heading", { name: "Мой путь" });
    await user.click(within(step(/принципы разработки/)).getByRole("button", { name: "Пройти тест" }));
    const dialog = screen.getByRole("dialog", { name: /Мини-тест/ });
    await user.click(within(dialog).getByLabelText("Сразу отправлять в PR"));
    await user.click(within(dialog).getByLabelText("Для изменений контрактов и архитектуры"));
    await user.click(within(dialog).getByRole("button", { name: "Проверить" }));
    expect(await within(dialog).findByText(/Есть ошибки \(1 вопрос\)/)).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("Читать, понимать и покрывать тестами, как свой"));
    await user.click(within(dialog).getByRole("button", { name: "Проверить" }));
    expect(await within(dialog).findByText("Тест пройден, шаг закрыт")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Отлично" }));
  });

  it("highlights the step from a notification link and recovers from a failed load", async () => {
    signIn();
    const target = plan().stages[1].items[0];
    const { user } = renderAt(`/plan?item=${target.id}`);
    await screen.findByRole("heading", { name: "Мой путь" });
    expect(document.getElementById(`step-${target.id}`)).toHaveClass("ring-2");
    expect(screen.getByRole("button", { name: /Вторая неделя/ })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: /Вторая неделя/ }));
    expect(screen.getByRole("button", { name: /Вторая неделя/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("shows an error with retry", async () => {
    signIn();
    server.use(http.get(url("/plan"), () => problem(500, "INTERNAL_ERROR")));
    renderAt("/plan");
    expect(await screen.findByText("Не удалось загрузить данные")).toBeInTheDocument();
  });

  it("builds Orbi phrases for every step action", () => {
    const base = plan().next_steps[0];
    expect(orbiPhrase({ ...base, action: { kind: "absence_request" } })).toBe("Хочу оформить отгул");
    expect(orbiPhrase({ ...base, action: { kind: "equipment" } })).toMatch(/ноутбук/);
    expect(orbiPhrase({ ...base, action: { kind: "ask_mentor" } })).toMatch(/наставнику/);
    expect(orbiPhrase({ ...base, action: { kind: "access_request" } })).not.toMatch(/ресурс/);
    expect(orbiPhrase({ ...base, action: null })).toBeNull();
  });
});

describe("requests and questions", () => {
  const submitted = (): ServiceRequest[] => {
    const [first, ...rest] = fixture<ServiceRequest[]>("requests.json");
    return [{ ...first, status: "submitted", status_title: "На согласовании", sla_due_at: "2026-11-15T08:00:00Z" }, ...rest];
  };

  it("lists requests with history and lets the intern remind or cancel", async () => {
    signIn();
    const actions: string[] = [];
    server.use(
      http.get(url("/requests"), () => HttpResponse.json(submitted())),
      http.post(url("/requests/:id/:action"), ({ params }) => {
        actions.push(String(params.action));
        return params.action === "cancel" ? problem(409, "REQUEST_TRANSITION_INVALID") : HttpResponse.json(submitted()[0]);
      }),
    );
    const { user } = renderAt(`/requests/${submitted()[0].id}`);
    const card = (await screen.findByText("ACC-1043")).closest("li") as HTMLElement;
    expect(within(card).getByRole("list", { name: "История заявки" })).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Напомнить согласующему" }));
    expect(await within(card).findByText("Напомнили согласующему")).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Отменить заявку" }));
    expect(await within(card).findByRole("alert")).toHaveTextContent("Заявку уже нельзя изменить");
    expect(actions).toEqual(["remind", "cancel"]);
    await user.click(screen.getByRole("button", { name: "Отгул" }));
    expect(useOrbiChat.getState().openSignal).toBe(1);
  });

  it("shows an empty state", async () => {
    signIn();
    server.use(http.get(url("/requests"), () => HttpResponse.json([])));
    renderAt("/requests");
    expect(await screen.findByText(/Заявок пока нет/)).toBeInTheDocument();
  });

  it("asks the mentor directly and closes a question", async () => {
    signIn();
    let closed = "";
    server.use(
      http.post(url("/escalations"), async ({ request }) => {
        const { question } = await request.json() as { question: string };
        return HttpResponse.json({ ...fixture<object[]>("escalations-kirill.json")[0], question });
      }),
      http.post(url("/escalations/:id/close"), ({ params }) => { closed = String(params.id); return HttpResponse.json(fixture<object[]>("escalations-kirill.json")[0]); }),
    );
    const { user } = renderAt("/questions");
    expect(await screen.findByText(/Как правильно называть ветки/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Спросить наставника напрямую" }), "Когда у нас стендап?");
    await user.click(screen.getByRole("button", { name: "Отправить вопрос" }));
    expect(await screen.findByText("Вопрос передан: Иван Петров")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Вопрос больше не актуален" }));
    await waitFor(() => expect(closed).not.toBe(""));
    await user.click(within(screen.getByRole("navigation", { name: "Разделы" })).getByRole("link", { name: "Заявки" }));
    expect(history.location.pathname).toBe("/requests");
  });

  it("shows the mentor's answer", async () => {
    signIn();
    server.use(http.get(url("/escalations"), () => HttpResponse.json([{
      ...fixture<object[]>("escalations-kirill.json")[0], status: "answered", answer: "По ключу задачи", answered_by_name: "Иван Петров",
      answered_at: "2026-11-14T09:00:00Z", faq_document_slug: "faq-branches",
    }])));
    renderAt("/questions");
    expect(await screen.findByText("По ключу задачи")).toBeInTheDocument();
    expect(screen.getByText(/Ответ добавлен в FAQ/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Спасибо, закрыть" })).toBeInTheDocument();
  });
});

describe("mentor screen", () => {
  it("is closed for interns", async () => {
    signIn();
    renderAt("/mentor");
    expect(await screen.findByText(/доступен наставникам/)).toBeInTheDocument();
  });

  it("reviews a step, completes a mentor task and answers with FAQ publishing", async () => {
    signIn("ivan.mentor@buddy.test");
    const reviews: unknown[] = [];
    let answer: unknown;
    server.use(
      http.post(url("/mentees/:mentee/plan/items/:item/review"), async ({ request }) => {
        reviews.push(await request.json());
        return HttpResponse.json(fixture<{ summary: { awaiting_review: object[] } }>("mentee-kirill.json").summary.awaiting_review[0]);
      }),
      http.post(url("/escalations/:id/answer"), async ({ request }) => {
        answer = await request.json();
        return HttpResponse.json({ ...fixture<object[]>("escalations-assigned.json")[0], status: "answered" });
      }),
    );
    const kirill = fixture<{ summary: { person: { id: string } } }>("mentee-kirill.json").summary.person.id;
    const { user } = renderAt(`/mentor/mentees/${kirill}`);
    expect(await screen.findByRole("heading", { name: "Кирилл Орлов", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Кирилл Орлов/ })).toHaveAttribute("aria-current", "page");
    const review = screen.getByRole("textbox", { name: /Комментарий к шагу «Сделай первый PR/ }).closest("li") as HTMLElement;
    expect(within(review).getByRole("button", { name: "Вернуть" })).toBeDisabled();
    await user.type(within(review).getByRole("textbox"), "Добавь тесты");
    await user.click(within(review).getByRole("button", { name: "Вернуть" }));
    await user.click(within(review).getByRole("button", { name: "Подтвердить" }));
    await user.click(screen.getAllByRole("button", { name: "Сделано" })[0]);
    await waitFor(() => expect(reviews).toHaveLength(3));
    expect(reviews[0]).toEqual({ transition: "return", comment: "Добавь тесты" });
    expect(reviews[2]).toEqual({ transition: "complete" });
    await user.type(screen.getByRole("textbox", { name: /Ответ на вопрос/ }), "По ключу задачи LST");
    await user.click(screen.getByRole("button", { name: "Ответить" }));
    await waitFor(() => expect(answer).toEqual({ answer: "По ключу задачи LST", publish_to_faq: true }));
  });

  it("asks to pick a mentee and highlights a question from a link", async () => {
    signIn("ivan.mentor@buddy.test");
    const question = fixture<{ id: string }[]>("escalations-assigned.json")[0].id;
    renderAt(`/mentor/questions/${question}`);
    expect(await screen.findByText(/Выбери стажёра слева/)).toBeInTheDocument();
    expect(await screen.findByText(/Как правильно называть ветки/)).toBeInTheDocument();
    expect(document.getElementById(`question-${question}`)).toHaveClass("ring-2");
  });
});

describe("portal header with a session", () => {
  it("shows role links, live notifications and the account menu", async () => {
    signIn();
    let readAll = false;
    server.use(http.post(url("/notifications/read-all"), () => { readAll = true; return new HttpResponse(null, { status: 204 }); }));
    const { user } = renderAt("/");
    expect(await screen.findByRole("link", { name: "Мой путь" })).toHaveAttribute("href", "/plan");
    expect(screen.queryByRole("link", { name: "Стажёры" })).not.toBeInTheDocument();
    const unread = fixture<{ unread: number }>("notifications.json").unread;
    await user.click(await screen.findByRole("button", { name: `Уведомления: ${unread} новых` }));
    const panel = screen.getByRole("dialog", { name: "Уведомления" });
    await user.click(within(panel).getByRole("button", { name: "Прочитать все" }));
    await waitFor(() => expect(readAll).toBe(true));
    await user.click(within(panel).getAllByRole("link")[0]);
    expect(history.location.pathname).toMatch(/^\/(requests|plan)/);
    await user.click(screen.getByRole("button", { name: "Аккаунт: Аня Смирнова" }));
    await user.click(screen.getByRole("menuitem", { name: "Выйти" }));
    await waitFor(() => expect(useSession.getState().status).toBe("anonymous"));
    expect((await screen.findAllByRole("link", { name: "Войти" }))[0]).toHaveAttribute("href", "/login");
  });

  it("shows the mentees link to a mentor", async () => {
    signIn("ivan.mentor@buddy.test");
    server.use(http.get(url("/notifications"), () => HttpResponse.json({ unread: 0, items: [] })));
    const { user } = renderAt("/");
    expect(await screen.findByRole("link", { name: "Стажёры" })).toHaveAttribute("href", "/mentor");
    await user.click(screen.getByRole("button", { name: "Уведомления" }));
    expect(screen.getByText(/Новых уведомлений нет/)).toBeInTheDocument();
  });
});
