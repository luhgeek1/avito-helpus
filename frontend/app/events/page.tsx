import type { Metadata } from "next";
import { EventsPage } from "@/_pages/portal";
export const metadata: Metadata = { title: "События" };

export default function Page() { return <EventsPage />; }
