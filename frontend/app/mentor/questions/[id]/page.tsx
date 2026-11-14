import { MentorPage } from "@/_pages/orbi";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MentorPage question={id} />;
}
