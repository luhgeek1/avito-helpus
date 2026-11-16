import type { Metadata } from "next";
import { ServicesPage } from "@/_pages/portal";
export const metadata: Metadata = { title: "Сервисы" };

export default function Page() { return <ServicesPage />; }
