import type { Metadata } from "next";
import { ArticlePage } from "@/_pages/portal";
export const metadata: Metadata = { title: "Публикация" };

export default function Page() { return <ArticlePage />; }
