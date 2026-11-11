import type { Metadata } from "next";
import { PetGalleryPage } from "@/_pages/pet-gallery";

export const metadata: Metadata = { title: "Галерея петов" };

export default async function Page({ searchParams }: {
  searchParams: Promise<{ pet?: string | string[] }>;
}) {
  const { pet } = await searchParams;
  return <PetGalleryPage requestedId={typeof pet === "string" ? pet : undefined} />;
}
