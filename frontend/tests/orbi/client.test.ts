import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createOrbiClient, readCookie } from "@/shared/api/orbi/client";

const clients: ReturnType<typeof createOrbiClient>[] = [];
const create = (options: Parameters<typeof createOrbiClient>[0]) => { const client = createOrbiClient(options); clients.push(client); return client; };
afterEach(() => { clients.forEach((client) => client.dispose()); clients.length = 0; vi.unstubAllGlobals(); });

describe("independent SDK transports", () => {
  it("keeps bearer tokens per client and refreshes once on 401 without cookies", async () => {
    const requests: RequestInit[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requests.push(init);
      return new Response('{}', { status: new Headers(init.headers).get('Authorization') === 'Bearer fresh' ? 200 : 401 });
    }));
    const getToken = vi.fn(({ forceRefresh }) => forceRefresh ? "fresh" : "old");
    const client = create({ apiUrl: "https://api.example.test/api/v1/", getToken });
    const other = create({ apiUrl: "/second" });
    expect(await client.boot()).toBe("old");
    await client.orbiJson("/me", z.object({}));
    expect(getToken).toHaveBeenCalledTimes(2);
    expect(requests.every((request) => request.credentials === "omit")).toBe(true);
    expect(other.tokens.get()).toBeNull();
    expect(fetch).toHaveBeenCalledWith("https://api.example.test/api/v1/me", expect.anything());
  });

  it("joins parallel refreshes and ignores a token delivered after disposal", async () => {
    let finish!: (value: string) => void;
    const getToken = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    const client = create({ apiUrl: "/api/v1", getToken });
    const first = client.refreshSession();
    expect(client.refreshSession()).toBe(first);
    client.dispose(); finish("private-old-account");
    expect(await first).toBeNull();
    expect(client.tokens.get()).toBeNull();
  });

  it("boots lazily, aborts fetches on unmount, and never calls the provider for public requests", async () => {
    const getToken = vi.fn(() => "token");
    const client = create({ apiUrl: "/api/v1", getToken });
    let signal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => { signal = init.signal; return new Response('{}'); }));
    await client.orbiFetch("/public", { auth: false });
    expect(getToken).not.toHaveBeenCalled();
    await client.orbiFetch("/private");
    expect(getToken).toHaveBeenCalledOnce();
    client.dispose(); expect(signal.aborted).toBe(true);
  });

  it("does not restore a token delivered after local sign-out", async () => {
    let resolve!: (value: string) => void;
    const client = create({ apiUrl: "/api/v1", getToken: () => new Promise((done) => { resolve = done; }) });
    const boot = client.boot();
    client.tokens.set(null); resolve("old-session");
    expect(await boot).toBeNull();
    expect(client.tokens.get()).toBeNull();
  });

  it("boots cookie sessions without making anonymous network requests and is safe on the server", async () => {
    document.cookie = "csrf_token=; max-age=0";
    const client = create({ apiUrl: "/api/v1" });
    expect(await client.boot()).toBeNull();
    document.cookie = "csrf_token=anya.intern@buddy.test";
    expect(await client.boot()).toContain("anya");
    document.cookie = "csrf_token=; max-age=0";
    vi.stubGlobal("document", undefined);
    expect(readCookie("csrf_token")).toBeNull();
  });
});
