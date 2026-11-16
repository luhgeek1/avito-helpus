import type { Metadata } from "next";
import { SearchPage } from "@/_pages/portal";
export const metadata: Metadata = { title: "Поиск" };

export default function Page() { return <SearchPage />; }
