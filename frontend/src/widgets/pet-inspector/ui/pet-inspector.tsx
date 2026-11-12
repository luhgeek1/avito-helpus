import { useState } from "react";
import type { CSSProperties } from "react";
import { Maximize2, Sparkles } from "lucide-react";
import { GroundShadow, PixelPet, usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import { FavoritePetButton } from "@/features/pet/favorite";
import { ChoosePetButton } from "@/features/pet/choose";
import { DownloadPetButton } from "@/features/pet/download";
import { GreetPetButton, usePetGreeting } from "@/features/pet/greet";
import { cx } from "@/shared/lib/cx";

const actionButton = cx(
  "flex min-h-9.25 items-center justify-center gap-1.75 rounded-md border border-[#ebe7f0] bg-white text-10 text-[#7f6b8f]",
  "hover:bg-[#f9f6fc] max-sm:min-h-11 max-sm:gap-1 max-sm:text-8",
);
export function PetInspector({ pet: active }: { pet: Pet }) {
  const [scale, setScale] = useState(2);
  const { paused } = usePetPreferences();
  const { speaking, greet } = usePetGreeting();
  return (
    <aside
      className="pet-detail sticky top-6 overflow-hidden rounded-[13px] border border-[#e6e3ec] bg-white
            shadow-[0_4px_12px_#2b213903] max-sm:relative max-sm:top-auto max-sm:w-full max-sm:scroll-mt-19.5
            max-sm:grid-cols-2 max-xs:flex max-xs:flex-col xs:max-sm:grid"
      aria-label="Знакомство с выбранным петом"
    >
      <div className="flex items-center justify-between px-4.5 pt-4.5 pb-4 max-sm:col-span-full max-sm:p-4.25 max-xs:w-full">
        <span className="text-8 tracking-[1.1px] text-[#807488]">ПОЗНАКОМИМСЯ?</span>
        <button
          className="hidden max-sm:block max-sm:min-h-11 max-sm:bg-transparent max-sm:p-1.5 max-sm:text-9 max-sm:text-[#9480ab]"
          onClick={() =>
            document
              .querySelector(".collection-toolbar")
              ?.scrollIntoView({ block: "start" })
          }
        >
          К коллекции ↑
        </button>
        <span className="flex items-center gap-1.25 text-9 text-[#7d8b7a]">
          <i className="size-1.25 rounded-full bg-[#9bbc89]" />
          Рядом
        </span>
      </div>
      <div
        className="relative mx-2.5 my-0 flex h-61 flex-col items-center justify-center overflow-hidden rounded-lg bg-pet-bg
            before:absolute before:inset-0 before:bg-[radial-gradient(var(--pet-color)_0.6px,transparent_0.6px)]
            before:bg-size-[12px_12px] before:opacity-10 before:content-[''] max-sm:col-start-1 max-sm:row-start-2
            max-sm:self-stretch max-xs:w-[calc(100%-20px)] xs:max-sm:mr-0 xs:max-sm:h-57.5 xl:h-67.5"
        style={
          {
            "--pet-bg": active.bg,
            "--pet-color": active.color,
          } as CSSProperties
        }
      >
        <span className="absolute top-11.25 right-10.75 size-1.25 bg-pet opacity-25
            shadow-[-5px_5px_var(--pet-color),5px_5px_var(--pet-color),0_10px_var(--pet-color)]" />
        <span className="absolute bottom-14 left-9.75 size-0.75 bg-pet opacity-25 shadow-[3px_-3px_var(--pet-color)]" />
        {speaking && (
          <div
            className="absolute inset-x-3.25 top-3.25 z-5 rounded-[7px] border border-[#e3dbe9] bg-white px-2.75 py-2.5
            text-10 leading-[1.6] text-[#756482] shadow-[0_3px_0_#00000003] after:absolute after:-bottom-1.25 after:left-1/2
            after:size-1.75 after:rotate-45 after:border-r after:border-b after:border-[#e3dbe9] after:bg-white
            after:content-[''] max-sm:inset-x-1.75 max-sm:top-2.5 max-sm:p-1.75 max-sm:text-9"
            role="status"
          >
            {active.greeting}
          </div>
        )}
        <div className="relative flex h-50 w-full items-end justify-center pb-3.5">
          <GroundShadow className="bottom-4.25 w-20.75" />
          <PixelPet
            key={active.id}
            pet={active}
            size={scale === 1 ? 128 : scale === 2 ? 160 : 192}
            paused={paused}
            className="max-xs:max-h-48 max-xs:max-w-48 xs:max-sm:max-h-40 xs:max-sm:max-w-40"
          />
        </div>
        <span className="absolute bottom-3 text-8 tracking-[0.3px] text-pet opacity-100 brightness-80 max-sm:bottom-3.5
            xs:max-sm:text-7">
          {paused
            ? "тихий режим"
            : active.category === "orbi" || active.id === "orbit"
              ? "на орбите и рядом"
              : "чувствует себя как дома"}
        </span>
      </div>
      <div className="flex items-center justify-between border-b border-[#f1eef4] px-4.75 py-3.25 max-sm:col-start-1
            max-sm:row-start-3 max-sm:my-0 max-sm:gap-1 max-sm:border-0 max-sm:px-0 max-xs:mx-4.25 max-xs:py-2
            xs:max-sm:mx-2 xs:max-sm:py-1.25">
        <span className="flex items-center gap-1.5 text-9 text-[#8a7c94] xs:max-sm:gap-0 xs:max-sm:text-[0px]">
          <Maximize2 size={13} />
          Масштаб
        </span>
        <div className="flex gap-0.75" aria-label="Масштаб персонажа">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={cx(
                "h-5.75 w-6.75 rounded-sm bg-transparent text-9 text-[#a9a2b1] max-sm:h-11 max-sm:w-10 max-sm:min-w-6.5",
                s === scale && "bg-[#f1edf7] font-[550] text-[#807090]",
              )}
              aria-label={`Масштаб ${s}×`}
              aria-pressed={s === scale}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="px-4.75 pt-5.25 pb-3.5 max-sm:col-start-2 max-sm:row-[2/4] max-sm:self-start max-xs:w-full
            max-xs:px-4.5 max-xs:py-3.75 xs:max-sm:py-0 xs:max-sm:pr-3.25 xs:max-sm:pl-3.75 xl:p-6">
        <div className="flex items-baseline gap-2.25 xs:max-sm:block">
          <h2 className="text-25 font-semibold tracking-[-0.7px] max-sm:text-24">{active.name}</h2>
          <span className="text-11 text-[#8b7e96] max-sm:mt-1 max-sm:block max-sm:text-10">{active.kind}</span>
        </div>
        <p className="mt-3 min-h-15.75 text-12 leading-[1.9] text-[#756b7e] max-sm:mt-2.5 max-sm:min-h-0 max-sm:leading-[1.7]
            xs:max-sm:text-10">{active.description}</p>
        <span className="mt-3.75 inline-block rounded-[5px] bg-[#f7f4f9] px-2.25 py-1.75 text-9 text-[#796784] max-sm:mt-2.25
            max-sm:p-1.5 max-sm:whitespace-nowrap xs:max-sm:text-7">{active.personality}</span>
        <div className="mx-0 my-5.5 flex items-center justify-between max-sm:my-3">
          <span className="text-10 text-[#83718e] xs:max-sm:text-8">Его цвета</span>
          <div className="flex gap-1.25 max-sm:gap-1">
            {active.palette.map((c) => (
              <span
                key={c}
                className="size-3.75 rounded-full border border-[#00000008] xs:max-sm:size-3"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </div>
        <ChoosePetButton pet={active} />
        <FavoritePetButton pet={active} showLabel />
        <div className="mt-2.25 flex gap-2 max-sm:mt-1.5 max-sm:gap-1.25">
          <GreetPetButton onGreet={greet} className={cx(actionButton, "flex-1 max-xs:text-10 xs:max-sm:text-8")} />
          <DownloadPetButton pet={active} className={cx(actionButton, "w-9.25 max-sm:w-8.75")} />
        </div>
      </div>
      <div className="flex items-center justify-center gap-1.5 border-t border-[#f1edf5] bg-[#fbfafc] px-2 py-3.25 text-8
            text-[#8a7898] max-sm:col-span-full max-xs:m-0 max-xs:w-full xs:max-sm:mt-3">
        <Sparkles size={14} />
        <span>Маленький пет, большая поддержка.</span>
      </div>
    </aside>
  );
}
