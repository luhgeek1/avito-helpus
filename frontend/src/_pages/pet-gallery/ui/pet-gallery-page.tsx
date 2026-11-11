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
    <main id="main-content" className={`gallery-page max-w-400 mt-auto mr-[auto] mb-[auto] ml-auto pt-10 pb-[22px] max-sm:pt-[25px] max-sm:pb-[18px]
            sm:max-md:pt-7 md:max-lg:pt-8 xl:pt-12 xl:pb-6 px-10 max-sm:px-[18px] sm:max-md:px-[22px] md:max-lg:px-7
            xl:px-14`}>
      <div className={`page-heading flex items-center justify-between gap-[30px] mb-9 max-sm:mb-[23px] xl:mb-10 [&_h1]:text-[35px]
            [&_h1]:font-[650] [&_h1]:tracking-[-1.3px] [&_h1]:leading-[1.2] [&_h1]:flex [&_h1]:items-center [&_h1]:gap-4
            max-xs:[&_h1]:text-[24px] max-sm:[&_h1]:tracking-[-1.2px] max-xs:[&_h1]:gap-[7px]
            max-sm:[&_h1]:whitespace-nowrap xs:max-sm:[&_h1]:text-[28px] xs:max-sm:[&_h1]:gap-[9px]
            sm:max-md:[&_h1]:text-[29px] md:max-lg:[&_h1]:text-[32px] xl:[&_h1]:text-[42px] [&_p]:text-[13px]
            [&_p]:text-[#706b79] [&_p]:leading-[1.85] [&_p]:mt-[13px] max-sm:[&_p]:text-[11px] max-sm:[&_p]:mt-[11px]
            max-sm:[&_p]:max-w-80`}>
        <div>
          <div className={`section-label text-[9px] text-[#77717f] tracking-[1.3px] flex items-center gap-[7px] mb-[15px] font-medium
            max-sm:text-[8px] max-sm:tracking-[1px] max-sm:mb-[11px]`}>
            <span className="tiny-pixel w-[6px] h-[6px] inline-block bg-[#b1a3cc] shrink-[0]" />
            ОРИГИНАЛ И {orbiCount} ВАРИАЦИЙ
          </div>
          <h1>
            Семейство Орби<span className={`heading-spark text-[34px] font-normal text-[#a18acc] max-xs:text-[21px] xs:max-sm:text-[25px]
            sm:max-md:text-[29px]`}>✳</span>
          </h1>
          <p>
            Летающий робот, один большой глаз и немного магии.
            <br className="desktop-break max-xs:hidden xs:max-sm:hidden" /> Отмечай любимые варианты — они
            соберутся в избранном.
          </p>
        </div>
        <div className={`collection-badge flex gap-[15px] items-center rounded-[12px] bg-[#f2eff8] [transform:rotate(3deg)] shrink-0
            mr-[9px] max-lg:hidden [&_>_span:last-child]:text-[11px] [&_>_span:last-child]:text-[#8e819f]
            [&_>_span:last-child]:leading-[1.75] [&_strong]:text-[#655672] [&_strong]:font-medium border border-solid
            border-[#e8e5ef] py-[15px] px-[17px]`}>
          <span className={`badge-pixels w-9 h-9 relative block [&_i]:w-3 [&_i]:h-3 [&_i]:absolute [&_i]:bg-[#b8a1de] [&_i]:left-0
            [&_i]:top-3 [&_i]:[box-shadow:12px_0_#b8a1de,_12px_-12px_#b8a1de,_24px_0_#b8a1de,_12px_12px_#b8a1de]
            [&_i:nth-child(2)]:w-1 [&_i:nth-child(2)]:h-1 [&_i:nth-child(2)]:bg-[#f5f0ff]
            [&_i:nth-child(2)]:[box-shadow:10px_0_#f5f0ff] [&_i:nth-child(2)]:top-[14px] [&_i:nth-child(2)]:left-[10px]
            [&_i:nth-child(3)]:hidden`}>
            <i />
            <i />
            <i />
          </span>
          <span>
            Оригинальный Орби.
            <br />
            <strong>И {orbiCount} вариаций.</strong>
          </span>
        </div>
      </div>
      <div className={`gallery-layout grid [grid-template-columns:minmax(0,_1fr)_280px] gap-[25px] items-start max-sm:flex
            max-md:[grid-template-columns:minmax(0,_1fr)_245px] max-sm:gap-[26px] max-sm:flex-col sm:max-md:gap-4
            md:max-lg:[grid-template-columns:minmax(0,_1fr)_255px] md:max-lg:gap-[18px]
            xl:[grid-template-columns:minmax(0,_1fr)_310px] xl:gap-8`}>
        <PetCollection activeId={active.id} onSelect={select} />
        <PetInspector key={active.id} pet={active} />
      </div>
      <div className={`bottom-note [border-top-width:1px] [border-top-style:solid] [border-top-color:var(--line)] flex items-center
            gap-[6px] text-[#8b7e96] text-[9px] mt-9 pt-5 max-sm:gap-1 max-sm:text-[8px] max-sm:mt-[26px] max-sm:pt-[17px]
            max-sm:flex-wrap max-sm:pb-[14px] [&_>_span:last-child]:ml-auto [&_>_span:last-child]:text-[8px]
            [&_>_span:last-child]:text-[#8b7e96] max-sm:[&_>_span:last-child]:text-[7px]`}>
        <span className="pixel-heart text-[#b8a6d1] text-[13px]">♥</span>Сделаны с заботой. Пиксель за
        пикселем.<span>Avito buddy · 2026</span>
      </div>
    </main>
  );
}
