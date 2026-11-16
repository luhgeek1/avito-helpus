import type { Metadata } from "next";
import { ProfilePage } from "@/_pages/portal";
export const metadata: Metadata = { title: "Профиль" };

export default function Page() { return <ProfilePage personId="me" />; }
