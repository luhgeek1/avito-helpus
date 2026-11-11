import { useEffect, useRef, useState } from "react";

export function useSpotlightShortcut(enabled: boolean, onOpen: () => void) {
  const [open, setOpen] = useState(false);
  const lastEnter = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) { lastEnter.current = null; setOpen(false); return; }
    const reset = () => { lastEnter.current = null; };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        reset(); return;
      }
      if (event.repeat) return;
      const target = event.target instanceof Element ? event.target : null;
      const insideSpotlight = open && target?.closest(".companion-spotlight");
      if (!insideSpotlight && (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])")
        || (target?.closest("button, a, [role=button]") && !target.closest(".widget-pet")))) {
        reset(); return;
      }
      const now = performance.now();
      if (lastEnter.current !== null && now - lastEnter.current <= 380) {
        event.preventDefault();
        event.stopPropagation();
        reset();
        if (open) setOpen(false);
        else { onOpen(); setOpen(true); }
      } else lastEnter.current = now;
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("pointerdown", reset, true);
    document.addEventListener("input", reset, true);
    window.addEventListener("blur", reset);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("pointerdown", reset, true);
      document.removeEventListener("input", reset, true);
      window.removeEventListener("blur", reset);
    };
  }, [enabled, onOpen, open]);
  return { open, show: () => { lastEnter.current = null; onOpen(); setOpen(true); },
    close: () => { lastEnter.current = null; setOpen(false); } };
}
