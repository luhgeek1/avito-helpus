import type { Metadata } from "next";
import { FeedPage } from "@/_pages/portal";
export const metadata: Metadata = { title: "Лента" };

export default function Page() { return <FeedPage />; }
