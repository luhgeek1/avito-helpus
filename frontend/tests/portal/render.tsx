import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createPortalQueryClient } from "@/_app/model/portal-provider";
import { HomePage, ProfilePage, ServicesPage, ServicePage, FeedPage, ArticlePage, EventsPage, BenefitsPage, SearchPage, AiPage, NotFoundPage } from "@/_pages/portal";
import { PortalShell } from "@/widgets/portal-shell";
import { useLocation, resetNavigation, history } from "./navigation";

function TestPages() {
  const { pathname } = useLocation();
  let page;
  if (pathname === "/") page = <HomePage />;
  else if (pathname === "/profile") page = <ProfilePage personId="me" />;
  else if (pathname.startsWith("/people/")) page = <ProfilePage personId={pathname.split("/")[2]} />;
  else if (pathname === "/services") page = <ServicesPage />;
  else if (pathname.startsWith("/services/")) page = <ServicePage />;
  else if (pathname === "/feed") page = <FeedPage />;
  else if (pathname.startsWith("/feed/")) page = <ArticlePage />;
  else if (pathname === "/events") page = <EventsPage />;
  else if (pathname.startsWith("/benefits/")) page = <BenefitsPage />;
  else if (pathname === "/search") page = <SearchPage />;
  else if (pathname === "/ai") page = <AiPage />;
  else page = <NotFoundPage />;
  return <PortalShell>{page}</PortalShell>;
}
export function renderApp(path = "/") {
  resetNavigation(path);
  const queryClient = createPortalQueryClient(), user = userEvent.setup();
  return { ...render(<QueryClientProvider client={queryClient}><TestPages /></QueryClientProvider>), user, history, queryClient };
}
export { screen };
