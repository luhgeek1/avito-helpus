import { ProfilePage } from "@/_pages/portal";
export default async function Page({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  return <ProfilePage personId={personId} />;
}
