import { useState } from "react";
import { ChevronRight, CircleHelp, Grid2X2, House } from "lucide-react";
import { pets } from "@/entities/pet";
import { AvitoMark } from "@/shared/ui/avito-mark";
import type { PageName, Navigate } from "@/shared/config";
export function Sidebar({
  page,
  navigate,
}: {
  page: PageName;
  navigate: Navigate;
}) {
  const [help, setHelp] = useState(false);
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate("home");
        }}
        aria-label="Avito buddy — главная"
      >
        <AvitoMark />
        <span>
          Avito<span className="brand-buddy">buddy</span>
        </span>
      </a>
      <div className="workspace">
        <span className="workspace-symbol">
          a<span>·</span>b
        </span>
        <div>
          <strong>Твоё пространство</strong>
          <span>Начинаем вместе</span>
        </div>
      </div>
      <div className="nav-label">ПРОСТРАНСТВО</div>
      <nav aria-label="Главная навигация">
        <a
          href="/"
          className={page === "home" ? "nav-item active" : "nav-item"}
          aria-current={page === "home" ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          <House size={19} />
          Главная
        </a>
        <a
          href="/pets"
          className={page === "pets" ? "nav-item active" : "nav-item"}
          aria-current={page === "pets" ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigate("pets");
          }}
        >
          <Grid2X2 size={19} />
          Галерея петов<span className="nav-count">{pets.length}</span>
        </a>
      </nav>
      <div className="sidebar-bottom">
        <div className="little-note">
          <span className="note-star">✦</span>
          <strong>
            Осваиваться проще,
            <br />
            когда ты не один.
          </strong>
          <span>Твой бадди всегда рядом.</span>
          <div className="note-pixels">
            <i />
            <i />
            <i />
          </div>
        </div>
        <button
          className="help-button"
          onClick={() => setHelp(!help)}
          aria-expanded={help}
        >
          <CircleHelp size={18} />О пространстве
          <ChevronRight size={16} />
        </button>
        {help && (
          <div className="help-note">
            Это дизайн-прототип AI-buddy для стажёров Авито. Пока здесь можно
            познакомиться с петами и выбрать спутника. Рабочий интерфейс
            появится позже.
          </div>
        )}
        <div className="profile">
          <span className="avatar">Я</span>
          <div>
            <strong>Будущий авитовец</strong>
            <span>Твоя история начинается</span>
          </div>
          <span className="online-dot" />
        </div>
      </div>
    </aside>
  );
}
