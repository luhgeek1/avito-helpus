import { QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { createPortalQueryClient } from "@/_app/model/portal-provider";
import { useOrbiNotice, useOrbiRealtime } from "@/shared/api";
import { server } from "../portal/setup";
import { signIn, sseResponse, url } from "./server";

function Live() { useOrbiRealtime(); return null; }

describe("realtime events", () => {
  it("passes notifications to the companion and refreshes affected data", async () => {
    signIn();
    const client = createPortalQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let connections = 0;
    server.use(http.get(url("/events"), () => {
      connections += 1;
      return sseResponse([
        "retry: 3000", ": keepalive",
        'event: request.updated\ndata: {"id":"r1","status":"approved"}',
        'event: notification.created\ndata: {"id":"n1","title":"Доступ одобрен","body":"ACC-1042","link":"/requests/r1"}',
        "event: notification.created\ndata: broken",
      ].join("\n\n") + "\n\n");
    }));
    const { unmount } = render(<QueryClientProvider client={client}><Live /></QueryClientProvider>);
    await waitFor(() => expect(useOrbiNotice.getState().notice).toMatchObject({ id: "n1", title: "Доступ одобрен", link: "/requests/r1" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["orbi", "requests"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["orbi", "notifications"] });
    expect(connections).toBe(1);
    unmount();
  });

  it("stays idle without a session", async () => {
    let connections = 0;
    server.use(http.get(url("/events"), () => { connections += 1; return sseResponse(""); }));
    render(<QueryClientProvider client={createPortalQueryClient()}><Live /></QueryClientProvider>);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(connections).toBe(0);
  });
});
