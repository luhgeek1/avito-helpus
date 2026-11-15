import { createOrbiClient } from "./client";
export { OrbiError } from "./error";
export { readCookie } from "./client";
export type { OrbiInit } from "./client";

/** Portal defaults; the npm component creates its own client at mount time. */
export const ORBI_API: string = process.env.NEXT_PUBLIC_ORBI_API ?? "/api/v1";
export const { tokens, refreshSession, orbiFetch, orbiJson } = createOrbiClient({ apiUrl: ORBI_API });
