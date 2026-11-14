import { readFileSync } from "node:fs";
import { join } from "node:path";
import { http, HttpResponse } from "msw";
import { onAccountChange, tokens, useSession } from "@/shared/api";

const dir = join(process.cwd(), "tests/orbi/fixtures");
export const fixture = <T = unknown>(name: string): T => JSON.parse(readFileSync(join(dir, name), "utf8")) as T;
/** Recorded streams; cards get a far expiry so they stay actionable whenever the suite runs. */
export const streamFixture = (name: string): string =>
  readFileSync(join(dir, name), "utf8").replace(/"expires_at": "[^"]+"/g, '"expires_at": "2099-01-01T00:00:00+00:00"');

export const API = "http://localhost:5173/api/v1";
export const url = (path: string) => `${API}${path}`;

/** A text/event-stream body, optionally split into chunks at arbitrary places. */
export function sseResponse(body: string, chunkSize = 0) {
  const encoder = new TextEncoder();
  const parts = chunkSize ? body.match(new RegExp(`[\\s\\S]{1,${chunkSize}}`, "g")) ?? [] : [body];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
  return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
}

export function problem(status: number, code: string, detail = "Problem") {
  return HttpResponse.json({ type: "about:blank", title: detail, status, detail, error_code: code }, { status });
}

export const sse = (...chunks: object[]) => `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;

/** Default happy-path backend for an intern; tests override single routes with server.use. */
export const orbiHandlers = [
  http.post(url("/auth/login"), async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    if (body.password !== "orbi-demo-2026") return problem(401, "WRONG_CREDENTIALS", "Wrong email or password");
    return HttpResponse.json({ access_token: `token-${body.email}`, expires_in: 900 });
  }),
  // The csrf cookie set by signIn() names the account, so the app's own session restore succeeds.
  http.post(url("/auth/refresh"), ({ request }) => {
    const csrf = request.headers.get("X-CSRF-Token");
    return csrf?.includes("@") ? HttpResponse.json({ access_token: `token-${csrf}`, expires_in: 900 }) : problem(401, "INVALID_TOKEN");
  }),
  http.post(url("/auth/logout"), () => new HttpResponse(null, { status: 204 })),
  http.get(url("/me"), ({ request }) =>
    HttpResponse.json(fixture(request.headers.get("Authorization")?.includes("ivan") ? "me-ivan.json" : "me-anya.json"))),
  http.get(url("/plan"), () => HttpResponse.json(fixture("plan.json"))),
  http.get(url("/requests"), () => HttpResponse.json(fixture("requests.json"))),
  http.get(url("/equipment"), () => HttpResponse.json(fixture("equipment.json"))),
  http.get(url("/notifications"), () => HttpResponse.json(fixture("notifications.json"))),
  http.post(url("/notifications/read-all"), () => new HttpResponse(null, { status: 204 })),
  http.post(url("/notifications/:id/read"), () => new HttpResponse(null, { status: 204 })),
  http.get(url("/escalations"), ({ request }) =>
    HttpResponse.json(fixture(new URL(request.url).searchParams.get("scope") === "assigned" ? "escalations-assigned.json" : "escalations-kirill.json"))),
  http.get(url("/mentees"), () => HttpResponse.json(fixture("mentees.json"))),
  http.get(url("/mentees/:id"), () => HttpResponse.json(fixture("mentee-kirill.json"))),
  http.get(url("/knowledge/documents/:slug"), () => HttpResponse.json(fixture("document.json"))),
  http.get(url("/chat/conversations"), () => HttpResponse.json([])),
  http.post(url("/chat/conversations"), () =>
    HttpResponse.json({ id: "conv-1", title: "Новый диалог", created_at: "2026-11-14T08:00:00Z", updated_at: "2026-11-14T08:00:00Z" }, { status: 201 })),
  http.post(url("/chat/conversations/:id/messages"), () => sseResponse(streamFixture("stream-card.txt"), 97)),
  http.post(url("/chat/conversations/:id/actions/:action"), () => sseResponse(streamFixture("stream-approved.txt"), 113)),
  http.post(url("/chat/messages/:id/feedback"), () => new HttpResponse(null, { status: 204 })),
  http.get(url("/events"), () => sseResponse("retry: 3000\n\n")),
];

/** Signs in without the login screen: the token goes to memory as after POST /auth/login. */
export function signIn(email = "anya.intern@buddy.test") {
  document.cookie = `csrf_token=${email}; path=/`;
  tokens.set(`token-${email}`);
  useSession.setState((state) => ({ status: "authenticated", epoch: state.epoch + 1 }));
}

export function signOut() {
  tokens.set(null);
  useSession.setState({ status: "anonymous" });
}

export { onAccountChange };
