import { useEffect, useRef, useState } from "react";

export function useTypewriter(text: string, active: boolean, paused: boolean, restartKey?: string) {
  const finished = useRef(false);
  const [progress, setProgress] = useState({ text, count: 0, restartKey });
  const [reducedMotion, setReducedMotion] = useState(
    false,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    finished.current = false;
    setProgress({ text, count: 0, restartKey });
    if (!active || paused || reducedMotion) return;
    let count = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (finished.current) return;
      count += 1;
      setProgress({ text, count, restartKey });
      if (count < text.length) {
        const delay = /[.!?…]/.test(text[count - 1]) ? 220
          : /[,;:]/.test(text[count - 1]) ? 110 : 34;
        timer = setTimeout(tick, delay);
      }
    };
    timer = setTimeout(tick, 120);
    return () => clearTimeout(timer);
  }, [text, active, paused, reducedMotion, restartKey]);

  const count = paused || reducedMotion ? text.length
    : progress.text === text && progress.restartKey === restartKey ? progress.count : 0;
  return {
    displayed: text.slice(0, count),
    typing: active && count < text.length,
    complete: () => {
      finished.current = true;
      setProgress({ text, count: text.length, restartKey });
    },
  };
}
