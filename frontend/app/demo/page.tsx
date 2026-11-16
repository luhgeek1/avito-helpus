import type { Metadata } from "next";
import { HomePage } from "@/_pages/portal";

export const metadata: Metadata = { title: "Демо Орби" };

export default function Page() { return <HomePage />; }
