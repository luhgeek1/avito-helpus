import { useEffect, useState } from "react";
import type { TransitionEvent } from "react";

export function useRadialTransition(open: boolean) {
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    setInteractive(false);
    if (!open) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInteractive(true);
      return;
    }
    // Cover interrupted transitions that finish without a transitionend event.
    const timer = setTimeout(() => setInteractive(true), 450);
    return () => clearTimeout(timer);
  }, [open]);
  function onTransitionEnd(event: TransitionEvent<HTMLElement>) {
    if (open && event.target === event.currentTarget && event.propertyName === "transform") setInteractive(true);
  }
  return { interactive, onTransitionEnd };
}
