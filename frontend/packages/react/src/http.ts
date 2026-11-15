import { runtime } from "./runtime";
import type { OrbiInit } from "../../../src/shared/api/orbi/client";
import type { z } from "zod";
export { OrbiError } from "../../../src/shared/api/orbi/error";
export { readCookie } from "../../../src/shared/api/orbi/client";
export const ORBI_API = "/api/v1";
export const orbiFetch = (path: string, init?: OrbiInit) => runtime().client.orbiFetch(path, init);
export const orbiJson = <S extends z.ZodType>(path: string, schema: S, init?: OrbiInit): Promise<z.infer<S>> =>
  runtime().client.orbiJson(path, schema, init);
export const refreshSession = () => runtime().client.refreshSession();
export const tokens = {
  get: () => runtime().client.tokens.get(),
  set: (token: string | null) => runtime().client.tokens.set(token),
  subscribe: (listener: (token: string | null) => void) => runtime().client.tokens.subscribe(listener),
};
