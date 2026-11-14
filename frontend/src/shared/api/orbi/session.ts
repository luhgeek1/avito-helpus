import { create } from "zustand";
import { orbiFetch, orbiJson, readCookie, refreshSession, tokens } from "./http";
import { tokenSchema } from "./schemas";

export type SessionStatus = "unknown" | "anonymous" | "authenticated";

type SessionState = {
  status: SessionStatus;
  /** Grows with every sign-in, so per-account connections restart. */
  epoch: number;
  /** Restores the session from the refresh cookie once per page load. */
  boot: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

let booting: Promise<void> | null = null;
const resets = new Set<() => void>();

/** Called when the signed-in person changes: caches and the conversation belong to the old one. */
export function onAccountChange(listener: () => void) {
  resets.add(listener);
  return () => { resets.delete(listener); };
}

function forgetAccount() {
  for (const reset of resets) reset();
}

export const useSession = create<SessionState>()((set) => ({
  status: "unknown",
  epoch: 0,
  boot() {
    // The readable csrf cookie lives as long as the refresh cookie: without it there is nothing to restore.
    booting ??= (readCookie("csrf_token") ? refreshSession() : Promise.resolve(null))
      .then((token) => { set({ status: token ? "authenticated" : "anonymous" }); });
    return booting;
  },
  async login(email, password) {
    const { access_token } = await orbiJson("/auth/login", tokenSchema, {
      method: "POST", json: { email, password }, auth: false,
    });
    forgetAccount();
    tokens.set(access_token);
    set((state) => ({ status: "authenticated", epoch: state.epoch + 1 }));
  },
  async logout() {
    try { await orbiFetch("/auth/logout", { method: "POST", auth: false }); } catch { /* the cookie is cleared anyway */ }
    forgetAccount();
    set({ status: "anonymous" });
    tokens.set(null);
  },
}));

// A failed refresh anywhere (expired session) signs the user out of the UI too.
tokens.subscribe((token) => {
  if (!token && useSession.getState().status === "authenticated") {
    forgetAccount();
    useSession.setState({ status: "anonymous" });
  }
});

export function resetSessionForTests() {
  booting = null;
  tokens.set(null);
  useSession.setState({ status: "unknown", epoch: 0 });
}
