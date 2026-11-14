import type { Metadata } from "next";
import { LoginPage } from "@/_pages/orbi";
export const metadata: Metadata = { title: "Вход" };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginPage next={next} />;
}
