import type { Metadata } from "next";
import { RequestsPage } from "@/_pages/orbi";
export const metadata: Metadata = { title: "Заявка" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestsPage tab="requests" selected={id} />;
}
