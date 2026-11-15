import { create } from "zustand";
import { runtime } from "./runtime";
import { tokenSchema } from "../../../src/shared/api/orbi/schemas";

export type SessionStatus = "unknown" | "anonymous" | "authenticated";
const resets = new Set<() => void>();
let operation = 0;
export const onAccountChange = (fn: () => void) => { resets.add(fn); return () => { resets.delete(fn); }; };
const forget = () => { for (const fn of resets) fn(); };
export const useSession = create<{
  status: SessionStatus; epoch: number;
  boot: () => Promise<void>; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>;
}>()((set) => ({
  status: "unknown", epoch: 0,
  async boot() {
    const version = ++operation;
    try {
      const token = await runtime().client.boot();
      if (version === operation) set({ status: token ? "authenticated" : "anonymous" });
    } catch (error) {
      if (version !== operation) return;
      set({ status: "anonymous" });
      runtime().props.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  },
  async login(email, password) {
    const version = ++operation;
    const client = runtime().client;
    const result = await client.orbiJson("/auth/login", tokenSchema, { method: "POST", auth: false, json: { email, password } });
    if (version !== operation) return;
    forget(); client.tokens.set(result.access_token);
    set((state) => ({ status: "authenticated", epoch: state.epoch + 1 }));
  },
  async logout() {
    const client = runtime().client;
    resetSessionForTests();
    set({ status: "anonymous" });
    client.tokens.set(null);
    try { await client.orbiFetch("/auth/logout", { method: "POST", auth: false }); } catch { /* Local sign-out works offline. */ }
  },
}));

export function resetSessionForTests() {
  operation += 1; forget();
  useSession.setState((state) => ({ status: "unknown", epoch: state.epoch + 1 }));
}

export function watchSession() {
  return runtime().client.tokens.subscribe((token) => {
    if (!token && useSession.getState().status === "authenticated") {
      forget(); useSession.setState({ status: "anonymous" });
    }
  });
}
