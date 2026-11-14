import type { Metadata } from "next";
import { RequestsPage } from "@/_pages/orbi";
export const metadata: Metadata = { title: "Мои вопросы" };
export default function Page() { return <RequestsPage tab="questions" />; }
