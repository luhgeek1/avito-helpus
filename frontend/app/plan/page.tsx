import type { Metadata } from "next";
import { PlanPage } from "@/_pages/orbi";
export const metadata: Metadata = { title: "Мой путь" };
export default async function Page({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const { item } = await searchParams;
  return <PlanPage highlight={item} />;
}
