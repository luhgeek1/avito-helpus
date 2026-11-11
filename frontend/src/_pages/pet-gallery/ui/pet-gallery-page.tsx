import { useState } from "react";
import { pets, defaultPet, usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import { PetCollection } from "@/widgets/pet-collection";
import { PetInspector } from "@/widgets/pet-inspector";
const orbiCount = pets.filter((pet) => pet.category === "orbi").length;

export function PetGalleryPage() {
  const { chosenPet } = usePetPreferences();
  const [active, setActive] = useState(() => {
    const requestedId = new URLSearchParams(location.search).get("pet");
    return (
      pets.find((pet) => pet.id === requestedId) ?? chosenPet ?? defaultPet
    );
  });
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
    <main className="gallery-page">
      <div className="page-heading">
        <div>
          <div className="section-label">
            <span className="tiny-pixel" />
            ОРИГИНАЛ И {orbiCount} ВАРИАЦИЙ
          </div>
          <h1>
            Семейство Орби<span className="heading-spark">✳</span>
          </h1>
          <p>
            Летающий робот, один большой глаз и немного магии.
            <br className="desktop-break" /> Отмечай любимые варианты — они
            соберутся в избранном.
          </p>
        </div>
        <div className="collection-badge">
          <span className="badge-pixels">
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
      <div className="gallery-layout">
        <PetCollection activeId={active.id} onSelect={select} />
        <PetInspector key={active.id} pet={active} />
      </div>
      <div className="bottom-note">
        <span className="pixel-heart">♥</span>Сделаны с заботой. Пиксель за
        пикселем.<span>Avito buddy · 2026</span>
      </div>
    </main>
  );
}
