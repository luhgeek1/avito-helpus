"use client";

import { useState } from "react";
import { pets, defaultPet, usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import { PetCollection } from "@/widgets/pet-collection";
import { PetInspector } from "@/widgets/pet-inspector";
const orbiCount = pets.filter((pet) => pet.category === "orbi").length;

export function PetGalleryPage({ requestedId }: { requestedId?: string }) {
  const { chosenPet } = usePetPreferences();
  const [selected, setActive] = useState<Pet | null>(null);
  const active = selected ?? pets.find((pet) => pet.id === requestedId) ?? chosenPet ?? defaultPet;
  function select(pet: Pet) {
    setActive(pet);
    if (window.matchMedia("(max-width: 650px)").matches)
      requestAnimationFrame(() =>
        document.querySelector(".pet-detail")?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "start",
        }),
      );
  }
  return (
    <main
      id="main-content"
      className="m-auto max-w-400 px-10 pt-10 pb-5.5 max-sm:px-4.5 max-sm:pt-6.25 max-sm:pb-4.5 sm:max-md:px-5.5
            sm:max-md:pt-7 md:max-lg:px-7 md:max-lg:pt-8 xl:px-14 xl:pt-12 xl:pb-6"
    >
      <div className="mb-9 flex items-center justify-between gap-7.5 max-sm:mb-5.75 xl:mb-10">
        <div>
          <div className="mb-3.75 flex items-center gap-1.75 text-9 font-medium tracking-[1.3px] text-[#77717f] max-sm:mb-2.75
            max-sm:text-8 max-sm:tracking-[1px]">
            <span className="inline-block size-1.5 shrink-0 bg-[#b1a3cc]" />
            ОРИГИНАЛ И {orbiCount} ВАРИАЦИЙ
          </div>
          <h1 className="flex items-center gap-4 text-35 leading-[1.2] font-[650] tracking-[-1.3px] max-sm:tracking-[-1.2px]
            max-sm:whitespace-nowrap max-xs:gap-1.75 max-xs:text-24 xs:max-sm:gap-2.25 xs:max-sm:text-28 sm:max-md:text-29
            md:max-lg:text-32 xl:text-42">
            Семейство Орби<span className="text-34 font-normal text-[#a18acc] max-xs:text-21 xs:max-sm:text-25
            sm:max-md:text-29">✳</span>
          </h1>
          <p className="mt-3.25 text-13 leading-[1.85] text-[#706b79] max-sm:mt-2.75 max-sm:max-w-80 max-sm:text-11">
            Летающий робот, один большой глаз и немного магии.
            <br className="max-xs:hidden xs:max-sm:hidden" /> Отмечай любимые варианты — они
            соберутся в избранном.
          </p>
        </div>
        <div className="mr-2.25 flex shrink-0 rotate-3 items-center gap-3.75 rounded-xl border border-[#e8e5ef] bg-[#f2eff8]
            px-4.25 py-3.75 max-lg:hidden">
          <span className="relative block size-9">
            <i className="absolute top-3 left-0 size-3 bg-[#b8a1de]
            shadow-[12px_0_#b8a1de,12px_-12px_#b8a1de,24px_0_#b8a1de,12px_12px_#b8a1de]" />
            <i className="absolute top-3.5 left-2.5 size-1 bg-[#f5f0ff] shadow-[10px_0_#f5f0ff]" />
            <i className="hidden" />
          </span>
          <span className="text-11 leading-[1.75] text-[#8e819f]">
            Оригинальный Орби.
            <br />
            <strong className="font-medium text-[#655672]">И {orbiCount} вариаций.</strong>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_280px] items-start gap-6.25 max-md:grid-cols-[minmax(0,1fr)_245px]
            max-sm:flex max-sm:flex-col max-sm:gap-6.5 sm:max-md:gap-4 md:max-lg:grid-cols-[minmax(0,1fr)_255px]
            md:max-lg:gap-4.5 xl:grid-cols-[minmax(0,1fr)_310px] xl:gap-8">
        <PetCollection activeId={active.id} onSelect={select} />
        <PetInspector key={active.id} pet={active} />
      </div>
      <div className="mt-9 flex items-center gap-1.5 border-t border-line pt-5 text-9 text-[#8b7e96] max-sm:mt-6.5
            max-sm:flex-wrap max-sm:gap-1 max-sm:pt-4.25 max-sm:pb-3.5 max-sm:text-8">
        <span className="text-13 text-[#b8a6d1]">♥</span>Сделаны с заботой. Пиксель за
        пикселем.<span className="ml-auto text-8 text-[#8b7e96] max-sm:text-7">Avito buddy · 2026</span>
      </div>
    </main>
  );
}
