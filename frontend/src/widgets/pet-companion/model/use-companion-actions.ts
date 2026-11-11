import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export function useCompanionActions(
  anchor: RefObject<HTMLDivElement | null>,
  showDialogue: (open: boolean) => void,
  dragging: boolean,
  visible: boolean,
) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lastActivation = useRef(0);
  const dismiss = useCallback(() => {
    setMenuOpen(false);
    setSettingsOpen(false);
    lastActivation.current = 0;
  }, []);
  useEffect(() => {
    if (dragging || !visible) dismiss();
    if (!visible) showDialogue(false);
  }, [dragging, visible, dismiss, showDialogue]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node)) dismiss();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!menuOpen && !settingsOpen && !anchor.current?.querySelector(".pixel-dialogue")) return;
      dismiss();
      showDialogue(false);
      anchor.current?.querySelector<HTMLButtonElement>(".widget-pet")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [anchor, dismiss, showDialogue, menuOpen, settingsOpen]);

  function activate(doubleClick = false) {
    const now = performance.now();
    if (doubleClick || (lastActivation.current && now - lastActivation.current < 380)) {
      dismiss();
      showDialogue(true);
    } else {
      lastActivation.current = now;
      showDialogue(false);
      setSettingsOpen(false);
      setMenuOpen((open) => !open);
    }
  }
  return {
    menuOpen, settingsOpen, activate, dismiss,
    chat() { dismiss(); showDialogue(true); },
    settings() { dismiss(); showDialogue(false); setSettingsOpen(true); },
  };
}
