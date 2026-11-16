import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { usePetPreferences } from "@/entities/pet";
import { cx } from "@/shared/lib/cx";
import { useTypewriter } from "../model/use-typewriter";
import type { CompanionTour } from "../model/use-companion-tour";

function Narration({ tour, hidden }: { tour: CompanionTour; hidden: boolean }) {
  const { paused } = usePetPreferences();
  const copy = useTypewriter(tour.text, tour.active, paused);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!hidden) ref.current?.focus({ preventScroll: true }); }, [tour.scene, hidden]);
  const { width: w, height: h } = tour.viewport;
  const compact = w <= 650;
  const stacked = w <= 1000;
  const below = compact && (tour.scene === "spotlight" || (tour.scene === "settings" && h >= 700));
  const centerX = tour.scene === "intro" && !compact ? w * .34 : w / 2;
  const sideLeft = tour.scene === "wardrobe" ? w * .24 + Math.min(330, h * .44 - 72) + 104 : centerX + 64 * tour.scale + 32;
  const width = Math.min(stacked ? 480 : 500, w - 32, stacked ? Infinity : w - sideLeft - 24);
  const left = stacked ? (w - width) / 2 : sideLeft;
  const above = stacked && !below && tour.scene !== "wardrobe";
  const bottom = above ? h * .53 + (compact ? 96 : 128) * tour.scale / 2 + 24 : below ? 16 : undefined;
  const top = tour.scene === "wardrobe" && stacked ? 72 : above || below ? undefined : h * .56 - 80;
  const style: CSSProperties = { width, left, top, bottom };
  if (hidden) return null;
  return <div ref={ref} tabIndex={-1} style={style} aria-label="Подсказка пета"
    className={cx(`transition-opacity group-data-[tour-closing=true]/tour:opacity-0 duration-200 pointer-events-auto cursor-pointer fixed z-60 rounded-none border-4 border-[#eef4fa] bg-white px-5 py-4 font-pixel text-18 leading-[1.75] text-[#33333d] shadow-[0_0_0_3px_#383c62,6px_6px_0_3px_#383c6226] outline-none max-sm:px-3 max-sm:py-3 max-sm:text-12
      after:absolute after:h-4 after:w-2 after:shadow-[3px_3px_#383c62] after:bg-white`,
      !stacked ? "after:-left-3 after:top-1/2" : below ? "after:-top-3 after:left-1/2" : "after:-bottom-3 after:left-1/2")}>
    <p className="sr-only" role="status">{tour.text}</p>
    <div className="grid" aria-hidden="true"><span className="invisible col-start-1 row-start-1">{tour.text}</span><span className="col-start-1 row-start-1">{copy.displayed}</span></div>
  </div>;
}

export function CompanionTourShell({ tour, hideCopy, children }: { tour: CompanionTour; hideCopy: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const lastAdvance = useRef(0);
  const next = () => {
    if (tour.closing || performance.now() - lastAdvance.current < 250) return;
    lastAdvance.current = performance.now(); tour.next();
  };
  useEffect(() => {
    const dialog = ref.current;
    if (!tour.active || !dialog) return;
    dialog.showModal();
    // The npm host does not need Tailwind; restore its original inline scroll state.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close(); document.body.style.overflow = overflow;
      (dialog.getRootNode() as Document | ShadowRoot).querySelector<HTMLButtonElement>(".widget-pet")?.blur();
    };
  }, [tour.active]);
  return <dialog ref={ref} role={tour.active ? "dialog" : "presentation"} aria-label={tour.active ? "Знакомство с петом" : undefined}
    onCancel={event => { if (tour.active) { event.preventDefault(); tour.finish(); } }}
    onClick={event => {
      if (!tour.active || (event.target as Element).closest("button,a,input,textarea,select,.companion,.companion-spotlight,.companion-chat,.companion-settings")) return;
      next();
    }}
    onKeyDownCapture={event => {
      if (!tour.active || event.key !== " " || event.repeat || event.nativeEvent.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
      if ((event.target as Element).closest("input,textarea,select,[contenteditable=true]")) return;
      event.preventDefault(); event.stopPropagation(); next();
    }}
    data-tour-scene={tour.active ? tour.scene : undefined} data-tour-closing={tour.closing}
    className={tour.active ? "companion-tour fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 text-inherit outline-none backdrop:bg-[#172034]/45 backdrop:backdrop-blur-[6px] backdrop:animate-appear backdrop:transition-opacity backdrop:duration-700 motion-reduce:backdrop:transition-none motion-reduce:backdrop:animate-none data-[tour-closing=true]:backdrop:animate-none data-[tour-closing=true]:backdrop:opacity-0 group/tour" : "contents border-0 bg-transparent p-0 text-inherit"}>
    {children}
    {tour.active && <>
      <Narration tour={tour} hidden={hideCopy} />
      <button type="button" onClick={tour.finish} disabled={tour.closing} className="transition-opacity duration-200 group-data-[tour-closing=true]/tour:opacity-0 fixed right-6 top-5 z-70 min-h-11 px-2 text-14 text-white max-sm:right-3 max-sm:top-3">Пропустить</button>
    </>}
  </dialog>;
}
