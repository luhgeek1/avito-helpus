import Link from "next/link";
import { ArrowRight, House } from "lucide-react";
export function HomePage() {
  return (
    <main id="main-content" className={`home relative min-h-[calc(100dvh_-_77px)] flex justify-center items-center flex-col text-center overflow-hidden
            max-sm:min-h-[calc(100dvh_-_114px)] sm:max-md:min-h-[calc(100dvh_-_65px)] [&_h1]:text-[36px] [&_h1]:font-[550]
            [&_h1]:tracking-[-1.4px] [&_h1]:mt-[15px] max-sm:[&_h1]:text-[27px] max-sm:[&_h1]:tracking-[-1px]
            [&_p]:text-[12px] [&_p]:leading-[1.9] [&_p]:text-[#a399ac] [&_p]:mt-[15px] max-sm:[&_p]:text-[11px] py-15
            max-sm:py-10 px-[30px] max-sm:px-5`}>
      <span className={`home-symbol w-16 h-16 bg-[#eee9f6] text-[#a998c1] grid place-items-center rounded-[19px] mb-7 max-sm:w-[55px]
            max-sm:h-[55px] max-sm:mb-[23px]`}>
        <House size={27} strokeWidth={1.5} />
      </span>
      <span className={`small-kicker text-[9px] tracking-[1.3px] text-[#a69caf] max-sm:text-[7px] max-sm:tracking-[0.8px]`}>СКОРО ЗДЕСЬ БУДЕТ ТВОЁ ПРОСТРАНСТВО</span>
      <h1>
        Интерфейс делается<span className="typing-dots text-[#a18dbd]">...</span>
      </h1>
      <p>
        А пока можно найти маленького друга
        <br />
        для большого начала.
      </p>
      <Link href="/pets" className={`primary-button home-cta flex items-center justify-center gap-5 bg-[#8067b6] text-white text-[11px] font-[450]
            min-h-[42px] rounded-[7px] [transition:background_0.18s,_transform_0.18s] [&:hover]:bg-[#6c54a0]
            [&:active]:[transform:translateY(1px)] mt-[27px] max-sm:text-[10px] py-[13px] px-[19px]`}>
        В галерею петов
        <ArrowRight size={18} />
      </Link>
      <div className={`home-pixels flex gap-[5px] items-end mt-[70px] opacity-60 [&_i]:w-2 [&_i]:h-2 [&_i]:bg-[#bfa7d8]
            [&_i:nth-child(2)]:h-[14px] [&_i:nth-child(2)]:bg-[#b2d2e5] [&_i:nth-child(3)]:h-[11px]
            [&_i:nth-child(3)]:bg-[#e5b7c9] [&_i:nth-child(4)]:h-[18px] [&_i:nth-child(4)]:bg-[#bdd4ac]`}>
        <i />
        <i />
        <i />
        <i />
      </div>
    </main>
  );
}
