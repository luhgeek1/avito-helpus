"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOrbiChat } from "@/features/orbi-chat";
import { useIntegrationAssistant } from "@/features/integration-assistant";
import { useOrbiNotice } from "@/shared/api";
import { attach, runtime } from "./runtime";
import { resetSessionForTests } from "./session";
import { useLoginDialog } from "./navigation";
import { createSurface } from "./shadow";
import { Content } from "./content";
import { controls } from "./controls";
import type { OrbiCompanionProps } from "./types";
export type { OrbiCompanionProps, OrbiHandle, OrbiTokenProvider } from "./types";

function Instance(props: OrbiCompanionProps) {
  const [surface, setSurface] = useState<ReturnType<typeof createSurface> | null>(null);
  const latest = useRef(props);
  latest.current = props;
  useImperativeHandle(props.ref, () => controls, []);
  useEffect(() => {
    const detach = attach(latest.current);
    const mounted = createSurface(latest.current.nonce, latest.current.zIndex ?? 1000);
    setSurface(mounted);
    return () => {
      useOrbiChat.getState().clear(); useIntegrationAssistant.getState().startOver(); useIntegrationAssistant.setState({ openSignal: 0 });
      useOrbiNotice.getState().show(null); useLoginDialog.getState().show(false);
      resetSessionForTests(); detach(); mounted.destroy();
    };
  }, []);
  useEffect(() => {
    if (surface) { runtime().props = props; surface.host.style.zIndex = String(props.zIndex ?? 1000); }
  }, [props, surface]);
  return surface ? createPortal(<Content {...props} />, surface.root) : null;
}

/** Mount once next to your application. SSR renders nothing; the browser adds an isolated overlay. */
export function OrbiCompanion(props: OrbiCompanionProps): React.ReactElement {
  const key = JSON.stringify([props.apiUrl, props.sessionKey, props.mode, Boolean(props.getToken), props.nonce]);
  return <Instance key={key} {...props} />;
}
