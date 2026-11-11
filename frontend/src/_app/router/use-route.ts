import { usePathname, useRouter } from "next/navigation";
import { routes } from "@/shared/config";
import type { Navigate, PageName } from "@/shared/config";

export function useRoute() {
  const pathname = usePathname();
  const router = useRouter();
  const page: PageName = pathname === routes.pets ? "pets" : "home";
  const navigate: Navigate = (next) => router.push(routes[next]);
  return { page, navigate };
}
