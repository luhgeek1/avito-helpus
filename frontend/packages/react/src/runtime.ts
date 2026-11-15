import { createOrbiClient } from "../../../src/shared/api/orbi/client";
import type { OrbiCompanionProps } from "./types";

type Runtime = { client: ReturnType<typeof createOrbiClient>; props: OrbiCompanionProps };
let active: Runtime | null = null;

export function runtime(): Runtime {
  if (!active) throw new Error("Mount OrbiCompanion before using its API");
  return active;
}

export function attach(props: OrbiCompanionProps) {
  if (active || document.querySelector("[data-orbi-sdk]")) throw new Error("Only one OrbiCompanion can be mounted per document");
  const apiUrl = props.apiUrl ?? "/api/v1";
  const url = new URL(apiUrl, window.location.origin);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("apiUrl must be an HTTP(S) base URL without credentials, query or fragment");
  }
  const value: Runtime = { props, client: createOrbiClient({ apiUrl,
    getToken: props.getToken ? (request) => value.props.getToken!(request) : undefined }) };
  active = value;
  return () => { value.client.dispose(); if (active === value) active = null; };
}
