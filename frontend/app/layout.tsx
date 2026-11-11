import type { Metadata } from "next";
import localFont from "next/font/local";
import { App } from "@/_app";
import "./globals.css";

const golos = localFont({ src: "../public/fonts/golos-text.ttf", variable: "--font-golos", weight: "400 900", display: "swap" });
const pixel = localFont({ src: "../public/fonts/press-start-2p.ttf", variable: "--font-pixel", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Главная — Avito buddy", template: "%s — Avito buddy" },
  description: "Рабочее пространство и пиксельный напарник для стажёров Авито.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${golos.variable} ${pixel.variable}`}>
      <body className={`m-0 bg-[#f7f8fa] font-sans text-[14px] leading-[normal] font-normal text-[#25252b] antialiased
            [font-synthesis:none] [text-rendering:optimizeLegibility] [--line:#e9e9ef] [--muted:#81818c] [--purple:#7760c4]
            [--ink:#25252b] [&_:where(button,a)]:touch-manipulation
            [&_:where(button,a)]:[-webkit-tap-highlight-color:transparent] [&_:where(button)]:cursor-pointer
            [&_:where(button:disabled)]:cursor-default [&_:where(button,a):focus-visible]:outline-[3px]
            [&_:where(button,a):focus-visible]:outline-[#a28bdd] [&_:where(button,a):focus-visible]:outline-offset-4
            [&_:where(button,a)_svg]:shrink-0 [&_svg]:align-middle motion-reduce:[&_*]:animate-none!
            motion-reduce:[&_*]:transition-none! motion-reduce:[&_*]:scroll-auto!`}>
        <App>{children}</App>
      </body>
    </html>
  );
}
