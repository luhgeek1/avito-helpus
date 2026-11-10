export const routes = { home: "/", pets: "/pets" } as const;
export type PageName = keyof typeof routes;
export type Navigate = (page: PageName) => void;
