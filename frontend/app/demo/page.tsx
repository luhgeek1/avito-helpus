import type { Metadata } from "next";
import { HomePage } from "@/_pages/portal";

export const metadata: Metadata = { title: "Демо Орби — портал «Хаб»" };

export default function Page() { return <HomePage />; }
