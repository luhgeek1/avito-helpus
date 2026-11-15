import type { Ref } from "react";

export type OrbiTokenProvider = (request: {
  forceRefresh: boolean;
  signal: AbortSignal;
}) => string | null | Promise<string | null>;

export type OrbiHandle = {
  /** Opens the chat and sends a question when authenticated. */
  ask: (text: string) => void;
  openChat: () => void;
  startOver: () => void;
  /** Restores the session after a host-side login. */
  refreshSession: () => Promise<void>;
};

export type OrbiCompanionProps = {
  apiUrl?: string;
  /** Change on sign-in, sign-out, or tenant switch to discard private state. */
  sessionKey?: string;
  /** Omit to use the Orbi server's refresh-cookie authentication. */
  getToken?: OrbiTokenProvider;
  /** Local installation help: no authentication or API calls. */
  mode?: "connected" | "guide";
  autoStartTour?: boolean;
  /** Maps the optional /login, /requests and /plan links to your platform. */
  onNavigate?: (path: string) => void;
  /** Full portal URL, for opening existing Orbi screens in another tab. */
  portalUrl?: string;
  onError?: (error: Error) => void;
  nonce?: string;
  zIndex?: number;
  ref?: Ref<OrbiHandle>;
};
