let startup: Promise<unknown> | undefined;

export function startPortalMocks() {
  if (process.env.NEXT_PUBLIC_API_MOCKS === "false") return Promise.resolve();
  startup ??= import("./mocks/browser").then(({ startFetchMocks }) => startFetchMocks());
  return startup;
}
