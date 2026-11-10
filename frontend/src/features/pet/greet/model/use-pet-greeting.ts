import { useEffect, useState } from "react";
export function usePetGreeting() {
  const [speaking, setSpeaking] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!speaking) return;
    const timer = setTimeout(() => setSpeaking(false), 6500);
    return () => clearTimeout(timer);
  }, [speaking, version]);
  function greet() {
    setSpeaking(true);
    setVersion((value) => value + 1);
  }
  return { speaking, greet };
}
