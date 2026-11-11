import { useCallback, useEffect, useRef, useState } from "react";
import { usePetPreferences } from "@/entities/pet";
import { usePetOnboarding } from "@/features/pet/onboarding";
import type { useCompanionPosition } from "./use-companion-position";
import type { useCompanionActions } from "./use-companion-actions";
import type { useSpotlightShortcut } from "./use-spotlight-shortcut";

type Scene = "intro" | "menu" | "chat" | "wardrobe" | "settings" | "spotlight" | "move";
const order: Scene[] = ["intro", "menu", "wardrobe", "settings", "spotlight", "move"];
const copy: Record<Scene, string> = {
  intro: "Привет! Я {name}, твой напарник. Покажу, что умею. Продолжить — клик или пробел.",
  menu: "Это моё меню: чат, гардероб и настройки. Открой гардероб — можно сразу примерить новый образ.",
  chat: "Здесь наша переписка. Напиши вопрос своими словами — например, как получить доступ к сервису.",
  wardrobe: "Покрути колесо или свайпни. Нажми на образ, чтобы выбрать его.",
  settings: "Здесь можно остановить анимацию или скрыть меня. Знакомство тоже можно повторить отсюда.",
  spotlight: "Два быстрых Enter — и можно задать вопрос. Ещё один Enter отправит его. Отвечу рядом с собой.",
  move: "Теперь попробуй меня перетащить. Чат и гардероб всегда будут рядом со мной. Вот и всё — давай осваиваться!",
};
type Controls = { movement: ReturnType<typeof useCompanionPosition>; actions: ReturnType<typeof useCompanionActions>;
  spotlight: ReturnType<typeof useSpotlightShortcut>; show: () => void; silence: () => void; draft: string };

export function useCompanionTour(controls: Controls) {
  const onboarding = usePetOnboarding();
  const { chosenPet } = usePetPreferences();
  const active = onboarding.active && onboarding.ready;
  const [scene, setScene] = useState<Scene>("intro");
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const live = useRef(controls); live.current = controls;
  const original = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const sceneRef = useRef(scene); sceneRef.current = scene;
  const scale = viewport.width > 1000 ? 3 : viewport.width > 650 ? 1.75 : 2;
  const finish = useRef(onboarding.finish); finish.current = onboarding.finish;
  const advance = useCallback(() => {
    const current = sceneRef.current;
    if (current === "move") finish.current();
    else setScene(current === "chat" ? "wardrobe" : order[order.indexOf(current) + 1]);
  }, []);
  useEffect(() => {
    const resize = () => setViewport({ width: innerWidth, height: innerHeight });
    resize(); window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!active) { setScene("intro"); return; }
    const c = live.current, box = c.movement.ref.current?.getBoundingClientRect();
    if (box && !original.current) {
      const compact = innerWidth <= 650;
      let saved: { x: number; y: number } | null = null;
      try { saved = JSON.parse(localStorage.getItem("buddy-position") ?? "null"); } catch { /* Use the normal corner position. */ }
      original.current = {
        x: Math.max(8, Math.min(saved && Number.isFinite(saved.x) ? saved.x : innerWidth - (compact ? 154 : 185), innerWidth - (compact ? 152 : 168))),
        y: Math.max(8, Math.min(saved && Number.isFinite(saved.y) ? saved.y : innerHeight - (compact ? 108 : 148), innerHeight - (compact ? 104 : 136))),
      };
    }
    dragged.current = false; c.show();
    return () => {
      const current = live.current;
      current.actions.dismiss(); current.spotlight.close(); current.silence();
      if (original.current && !dragged.current) current.movement.relocate(original.current);
      original.current = null;
    };
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const c = live.current, compact = viewport.width <= 650;
    const width = (compact ? 144 : 160) * scale;
    const height = (compact ? 96 : 128) * scale;
    const x = Math.round(scene === "wardrobe" ? Math.max(8, viewport.width * .24 - width / 2) : scene === "intro" && !compact ? viewport.width * .34 - width / 2 : (viewport.width - width) / 2);
    const y = Math.round(scene === "chat" ? viewport.height - height - 20 : viewport.height * (scene === "wardrobe" && compact ? .60 : viewport.width <= 1000 ? .47 : .56) - height / 2);
    const before = c.movement.ref.current?.getBoundingClientRect();
    c.show(); c.actions.dismiss(); c.spotlight.close(); c.silence();
    c.movement.relocate({ x, y });
    const duration = !before || matchMedia("(prefers-reduced-motion: reduce)").matches ? 0
      : Math.hypot(before.left - x, before.top - y) < 2 ? 0 : 640;
    let animation: Animation | undefined;
    const frame = requestAnimationFrame(() => {
      if (duration && before) animation = c.movement.ref.current?.querySelector(".widget-pet")?.animate([
        { transform: `translate3d(${before.left - x}px, ${before.top - y}px, 0)` }, { transform: "none" },
      ], { duration, easing: "cubic-bezier(.22,1,.36,1)" });
    });
    const timer = setTimeout(() => {
      const current = live.current;
      if (scene === "menu") current.actions.menu();
      if (scene === "chat") current.actions.chat();
      if (scene === "wardrobe") current.actions.wardrobe();
      if (scene === "settings") current.actions.settings();
      if (scene === "spotlight" && compact) current.spotlight.show();
    }, duration + 120);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); animation?.cancel(); };
  }, [active, scene, viewport, scale]);
  useEffect(() => {
    if (active && scene === "move" && controls.movement.dragging) dragged.current = true;
  }, [active, scene, controls.movement.dragging]);
  return { active, scene, text: copy[scene].replace("{name}", chosenPet?.name ?? "Орби"), viewport, scale, next: advance,
    finish: onboarding.finish, visit: setScene,
    dragged: () => { if (active && scene === "move") dragged.current = true; },
  };
}

export type CompanionTour = ReturnType<typeof useCompanionTour>;
