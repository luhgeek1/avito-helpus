import type { Metadata } from "next";
import { RequestsPage } from "@/_pages/orbi";
export const metadata: Metadata = { title: "Заявки и вопросы" };
export default function Page() { return <RequestsPage tab="requests" />; }
