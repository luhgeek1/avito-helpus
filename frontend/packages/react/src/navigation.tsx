import type { AnchorHTMLAttributes } from "react";
import { create } from "zustand";
import { runtime } from "./runtime";

export const useLoginDialog = create<{ open: boolean; show: (open: boolean) => void }>()((set) => ({
  open: false, show: (open) => set({ open }),
}));

export function Link({ to, children, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const { props } = runtime();
  const guide = props.mode === "guide" && to.startsWith("/#");
  if (!guide && !props.onNavigate && !props.portalUrl && to !== "/login") return null;
  const href = props.portalUrl ? new URL(to, props.portalUrl).href : guide
    ? "https://github.com/luhgeek1/avito-helpus/blob/feat/orbi-react-sdk/frontend/packages/react/README.md" : "#orbi";
  return <a {...rest} href={href} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (props.onNavigate) { event.preventDefault(); props.onNavigate(to); }
    else if (!guide && !props.portalUrl) { event.preventDefault(); useLoginDialog.getState().show(true); }
  }}>{children}</a>;
}
