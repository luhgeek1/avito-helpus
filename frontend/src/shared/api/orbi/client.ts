import type { z } from "zod";
import { OrbiError } from "./error";

export type TokenProvider = (options: { forceRefresh: boolean; signal: AbortSignal }) => string | null | Promise<string | null>;
export type OrbiClientOptions = { apiUrl: string; getToken?: TokenProvider };
export type OrbiInit = Omit<RequestInit, "body"> & { json?: unknown; auth?: boolean };

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function problem(response: Response): Promise<OrbiError> {
  let body: { error_code?: unknown; detail?: unknown; title?: unknown } = {};
  try {
    const value: unknown = await response.json();
    if (value && typeof value === "object") body = value;
  } catch { /* not JSON: keep the status */ }
  const code = typeof body.error_code === "string" ? body.error_code : `HTTP_${response.status}`;
  const detail = typeof body.detail === "string" ? body.detail
    : typeof body.title === "string" ? body.title : `Ошибка сервера (${response.status})`;
  return new OrbiError(response.status, code, detail);
}

export function createOrbiClient(options: OrbiClientOptions) {
  type Listener = (token: string | null) => void;

  /** The access token lives in memory only; the refresh token is an httpOnly cookie. */
  let accessToken: string | null = null;
  let tokenVersion = 0;
  const listeners = new Set<Listener>();
  const lifetime = new AbortController();
  let refreshing: Promise<string | null> | null = null;

  const tokens = {
    get: () => accessToken,
    set(token: string | null) {
      tokenVersion += 1;
      accessToken = token;
      for (const listener of listeners) listener(token);
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };

  function url(path: string) {
    return new URL(`${options.apiUrl.replace(/\/$/, "")}${path}`, window.location.origin).toString();
  }

  /** One refresh at a time: parallel 401s wait for the same rotation. */
  function refreshSession(): Promise<string | null> {
    const version = tokenVersion;
    refreshing ??= (async () => {
      try {
        if (options.getToken) {
          const token = await options.getToken({ forceRefresh: true, signal: lifetime.signal });
          if (version === tokenVersion && !lifetime.signal.aborted) tokens.set(token);
          return accessToken;
        }
        const csrf = readCookie("csrf_token");
        const response = await fetch(url("/auth/refresh"), {
          method: "POST", credentials: "include", signal: lifetime.signal,
          headers: csrf ? { "X-CSRF-Token": csrf } : undefined,
        });
        if (version !== tokenVersion || lifetime.signal.aborted) return accessToken;
        if (!response.ok) { tokens.set(null); return null; }
        const { access_token } = await response.json() as { access_token?: unknown };
        if (version !== tokenVersion || lifetime.signal.aborted) return accessToken;
        if (typeof access_token !== "string" || !access_token) { tokens.set(null); return null; }
        tokens.set(access_token);
        return access_token;
      } catch {
        return null;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  /** Raw call with auth and a single transparent refresh on 401. Throws OrbiError on failure. */
  async function orbiFetch(path: string, init: OrbiInit = {}): Promise<Response> {
    const { json, auth = true, headers, ...rest } = init;
    const send = (token: string | null) => {
      const merged = new Headers(headers);
      if (json !== undefined) merged.set("Content-Type", "application/json");
      if (auth && token) merged.set("Authorization", `Bearer ${token}`);
      return fetch(url(path), {
        ...rest, headers: merged, credentials: options.getToken ? "omit" : "include",
        signal: init.signal ? AbortSignal.any([init.signal, lifetime.signal]) : lifetime.signal,
        body: json === undefined ? undefined : JSON.stringify(json),
      });
    };
    let response: Response;
    try {
      if (auth && options.getToken && !accessToken) {
        const version = tokenVersion;
        const token = await options.getToken({ forceRefresh: false, signal: lifetime.signal });
        lifetime.signal.throwIfAborted();
        if (version === tokenVersion) tokens.set(token);
      }
      response = await send(accessToken);
      if (response.status === 401 && auth) {
        const fresh = await refreshSession();
        if (fresh) response = await send(fresh);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new OrbiError(0, "NETWORK", "Нет соединения с сервером");
    }
    if (!response.ok) throw await problem(response);
    return response;
  }

  /** JSON call validated by a Zod schema, so a contract drift surfaces at the boundary. */
  async function orbiJson<S extends z.ZodType>(path: string, schema: S, init?: OrbiInit): Promise<z.infer<S>> {
    const response = await orbiFetch(path, init);
    const text = await response.text();
    let value: unknown;
    try { value = text ? JSON.parse(text) : undefined; }
    catch { throw new OrbiError(response.status, "BAD_RESPONSE", "Сервер вернул данные в неожиданном формате"); }
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new OrbiError(response.status, "BAD_RESPONSE", "Сервер вернул данные в неожиданном формате");
    return parsed.data;
  }

  return { tokens, refreshSession, orbiFetch, orbiJson,
    async boot() {
      if (!options.getToken) return readCookie("csrf_token") ? refreshSession() : null;
      const version = tokenVersion;
      const token = await options.getToken({ forceRefresh: false, signal: lifetime.signal });
      lifetime.signal.throwIfAborted();
      if (version === tokenVersion) tokens.set(token);
      return accessToken;
    },
    dispose() { lifetime.abort(); tokens.set(null); listeners.clear(); },
  };
}
