import type { z } from "zod";

/** Orbi backend lives next to the portal: nginx in Docker, Next rewrites in development. */
export const ORBI_API: string = process.env.NEXT_PUBLIC_ORBI_API ?? "/api/v1";

/** RFC 7807 problem from the backend; branch on `code`, never on the text. */
export class OrbiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.name = "OrbiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

type Listener = (token: string | null) => void;

/** The access token lives in memory only; the refresh token is an httpOnly cookie. */
let accessToken: string | null = null;
const listeners = new Set<Listener>();
let refreshing: Promise<string | null> | null = null;

export const tokens = {
  get: () => accessToken,
  set(token: string | null) {
    accessToken = token;
    for (const listener of listeners) listener(token);
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

function url(path: string) {
  return new URL(`${ORBI_API}${path}`, window.location.origin).toString();
}

export function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function problem(response: Response): Promise<OrbiError> {
  let body: { error_code?: unknown; detail?: unknown; title?: unknown } = {};
  try { body = await response.json() as typeof body; } catch { /* not JSON: keep the status */ }
  const code = typeof body.error_code === "string" ? body.error_code : `HTTP_${response.status}`;
  const detail = typeof body.detail === "string" ? body.detail
    : typeof body.title === "string" ? body.title : `Ошибка сервера (${response.status})`;
  return new OrbiError(response.status, code, detail);
}

/** One refresh at a time: parallel 401s wait for the same rotation. */
export function refreshSession(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const csrf = readCookie("csrf_token");
      const response = await fetch(url("/auth/refresh"), {
        method: "POST", credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : undefined,
      });
      if (!response.ok) { tokens.set(null); return null; }
      const { access_token } = await response.json() as { access_token: string };
      tokens.set(access_token);
      return access_token;
    } catch {
      return accessToken;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export type OrbiInit = Omit<RequestInit, "body"> & { json?: unknown; auth?: boolean };

/** Raw call with auth and a single transparent refresh on 401. Throws OrbiError on failure. */
export async function orbiFetch(path: string, init: OrbiInit = {}): Promise<Response> {
  const { json, auth = true, headers, ...rest } = init;
  const send = (token: string | null) => {
    const merged = new Headers(headers);
    if (json !== undefined) merged.set("Content-Type", "application/json");
    if (auth && token) merged.set("Authorization", `Bearer ${token}`);
    return fetch(url(path), {
      ...rest, headers: merged, credentials: "include",
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  };
  let response: Response;
  try {
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
export async function orbiJson<S extends z.ZodType>(path: string, schema: S, init?: OrbiInit): Promise<z.infer<S>> {
  const response = await orbiFetch(path, init);
  if (response.status === 204 || response.status === 202) return schema.parse(undefined);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new OrbiError(response.status, "BAD_RESPONSE", "Сервер вернул данные в неожиданном формате");
  return parsed.data;
}
