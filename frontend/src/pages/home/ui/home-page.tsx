import { ArrowRight, House } from "lucide-react";
export function HomePage({ onOpenGallery }: { onOpenGallery: () => void }) {
  return (
    <main className="home">
      <span className="home-symbol">
        <House size={27} strokeWidth={1.5} />
      </span>
      <span className="small-kicker">СКОРО ЗДЕСЬ БУДЕТ ТВОЁ ПРОСТРАНСТВО</span>
      <h1>
        Интерфейс делается<span className="typing-dots">...</span>
      </h1>
      <p>
        А пока можно найти маленького друга
        <br />
        для большого начала.
      </p>
      <button className="primary-button home-cta" onClick={onOpenGallery}>
        В галерею петов
        <ArrowRight size={18} />
      </button>
      <div className="home-pixels">
        <i />
        <i />
        <i />
        <i />
      </div>
    </main>
  );
}
