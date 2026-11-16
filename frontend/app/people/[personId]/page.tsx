import type { Metadata } from "next";
import { ProfilePage } from "@/_pages/portal";
export const metadata: Metadata = { title: "Сотрудник" };

export default async function Page({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  return <ProfilePage personId={personId} />;
}
