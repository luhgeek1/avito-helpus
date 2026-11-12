import type { Metadata } from "next";
import localFont from "next/font/local";
import { App } from "@/_app";
import "./globals.css";

const golos = localFont({ src: "../public/fonts/golos-text.ttf", variable: "--font-golos", weight: "400 900", display: "swap" });
const pixel = localFont({ src: "../public/fonts/press-start-2p.ttf", variable: "--font-pixel", display: "swap" });
const portal = localFont({ src: [
  { path: "../public/portal/fonts/inter-regular.ttf", weight: "400" },
  { path: "../public/portal/fonts/inter-bold.ttf", weight: "700" },
], variable: "--font-portal", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Хаб — внутренний портал Авито", template: "%s — Хаб" },
  description: "Рабочее пространство и пиксельный напарник для стажёров Авито.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${golos.variable} ${pixel.variable} ${portal.variable}`}>
      <body className="m-0 bg-canvas font-sans text-14 leading-[normal] font-normal text-ink antialiased
            [--line:#e9e9ef] [--muted:#81818c] [--purple:#7760c4] [--ink:#25252b]">
        <App>{children}</App>
      </body>
    </html>
  );
}
