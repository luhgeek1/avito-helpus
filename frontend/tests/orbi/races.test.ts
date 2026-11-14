import { expect, it } from "vitest";
import { useOrbiChat } from "@/features/orbi-chat";
import { OrbiError, orbiFetch, refreshSession, tokens } from "@/shared/api";
import { http, HttpResponse } from "msw";
import { server } from "../portal/setup";
import { problem, signIn, sse, sseResponse, streamFixture, url } from "./server";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

it("does not restore an old conversation after the account has been cleared", async () => {
  signIn();
  const response = deferred<Response>();
  server.use(http.post(url("/chat/conversations"), () => response.promise));
  const pending = useOrbiChat.getState().send("Private message");
  useOrbiChat.getState().clear();
  response.resolve(HttpResponse.json({ id: "old-account", title: "Old", created_at: "", updated_at: "" }));
  await pending;
  expect(useOrbiChat.getState()).toMatchObject({ conversationId: null, messages: [], busy: false });
});

it("does not mark a decision or send it twice while its response is pending", async () => {
  signIn();
  await useOrbiChat.getState().send("Access");
  const action = useOrbiChat.getState().messages.flatMap((m) => m.parts).find((p) => p.type === "action")!;
  if (action.type !== "action") throw new Error("Missing fixture action");
  const response = deferred<Response>();
  let calls = 0;
  server.use(http.post(url("/chat/conversations/:id/actions/:action"), () => { calls += 1; return response.promise; }));
  const pending = useOrbiChat.getState().decide(action.data.id, "approve");
  expect(await useOrbiChat.getState().decide(action.data.id, "approve")).toBeUndefined();
  expect(useOrbiChat.getState().messages[1].parts.find((p) => p.type === "action")).toMatchObject({ data: { status: "pending" } });
  response.resolve(sseResponse(streamFixture("stream-approved.txt")));
  await pending;
  expect(await useOrbiChat.getState().decide(action.data.id, "approve")).toBeUndefined();
  expect(calls).toBe(1);
});

it("keeps an already-decided 409 neutral instead of claiming this client's approval", async () => {
  signIn();
  await useOrbiChat.getState().send("Access");
  const action = useOrbiChat.getState().messages.flatMap((m) => m.parts).find((p) => p.type === "action")!;
  if (action.type !== "action") throw new Error("Missing fixture action");
  server.use(http.post(url("/chat/conversations/:id/actions/:action"), () => problem(409, "ACTION_ALREADY_DECIDED")));
  const reply = await useOrbiChat.getState().decide(action.data.id, "approve");
  expect(reply?.error).toMatch(/уже принято решение/);
  expect(useOrbiChat.getState().messages[1].parts.find((p) => p.type === "action")).toMatchObject({ data: { status: "decided" } });
});

it("ignores late history after clearing the account and does not replace a new conversation", async () => {
  signIn();
  const response = deferred<Response>();
  const conversation = { id: "old", title: "Old", created_at: "", updated_at: "" };
  server.use(http.get(url("/chat/conversations"), () => response.promise));
  const pending = useOrbiChat.getState().load();
  useOrbiChat.getState().clear();
  response.resolve(HttpResponse.json([conversation]));
  await pending;
  expect(useOrbiChat.getState()).toMatchObject({ conversationId: null, loaded: false, messages: [] });
});

it("does not let the old stream clear the busy state of a new one", async () => {
  signIn();
  useOrbiChat.setState({ conversationId: "c" });
  const firstResponse = deferred<Response>(), secondResponse = deferred<Response>();
  let calls = 0;
  server.use(http.post(url("/chat/conversations/:id/messages"), () => (++calls === 1 ? firstResponse.promise : secondResponse.promise)));
  const first = useOrbiChat.getState().send("Old");
  // Wait until the request is in flight, then replace the account state.
  await new Promise((resolve) => setTimeout(resolve, 30));
  useOrbiChat.getState().clear();
  useOrbiChat.setState({ conversationId: "new" });
  const second = useOrbiChat.getState().send("New");
  firstResponse.resolve(sseResponse(sse({ type: "finish" })));
  await first;
  expect(useOrbiChat.getState().busy).toBe(true);
  secondResponse.resolve(sseResponse(sse({ type: "text-delta", id: "t", delta: "New answer" }, { type: "finish" })));
  await second;
  expect(useOrbiChat.getState().messages).toHaveLength(2);
  expect(useOrbiChat.getState().messages[1].parts).toMatchObject([{ text: "New answer" }]);
});

it("keeps a failed decision pending so it can be retried without claiming success", async () => {
  signIn();
  await useOrbiChat.getState().send("Access");
  const action = useOrbiChat.getState().messages.flatMap((m) => m.parts).find((p) => p.type === "action")!;
  if (action.type !== "action") throw new Error("Missing fixture action");
  server.use(http.post(url("/chat/conversations/:id/actions/:action"), () => problem(404, "NOT_FOUND")));
  await useOrbiChat.getState().decide(action.data.id, "approve");
  const card = useOrbiChat.getState().messages.flatMap((m) => m.parts).find((p) => p.type === "action");
  expect(card).toMatchObject({ data: { status: "pending" } });
});

it("surfaces a truncated stream as a failure instead of a completed answer", async () => {
  signIn();
  server.use(http.post(url("/chat/conversations/:id/messages"), () => sseResponse('data: {"type":"text-delta","id":"t","delta":"Partial"}\n\n')));
  const reply = await useOrbiChat.getState().send("Question");
  expect(reply?.error).toMatch(/прерван/);
  expect(reply?.streaming).toBe(false);
});

it("does not restore an obsolete refresh token after another account signs in", async () => {
  const response = deferred<Response>();
  server.use(http.post(url("/auth/refresh"), () => response.promise));
  tokens.set("old");
  const pending = refreshSession();
  tokens.set("new-account");
  response.resolve(HttpResponse.json({ access_token: "old-refreshed" }));
  await pending;
  expect(tokens.get()).toBe("new-account");
});

it.each([null, [], "bad"])("handles non-object RFC problem payload %j", async (payload) => {
  server.use(http.get(url("/bad-problem"), () => HttpResponse.json(payload, { status: 500 })));
  await expect(orbiFetch("/bad-problem")).rejects.toBeInstanceOf(OrbiError);
});
