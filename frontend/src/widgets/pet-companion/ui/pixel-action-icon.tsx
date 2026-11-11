export type CompanionAction = "chat" | "wardrobe" | "settings";

const icons: Record<CompanionAction, string> = {
  chat: "M3 3h10v1h1v8h-1v1H7v1H6v1H4v-3H2V4h1z M4 5v5h2v2h1v-1h5V5z M5 7h2v1H5z M9 7h2v1H9z",
  wardrobe: "M5 2h2v2h2V2h2v1h2v1h2v4h-3v6H4V8H1V4h2V3h2z M4 5H3v1h3v6h4V6h3V5h-2v1H5V5z",
  settings: "M6 1h4v2h2v1h2v2h1v4h-2v2h-1v2h-2v1H6v-2H4v-1H2v-2H1V6h2V4h1V2h2z M6 5v1H5v4h1v1h4v-1h1V6h-1V5z M7 7h2v2H7z",
};
export function PixelActionIcon({ action }: { action: CompanionAction }) {
  return <svg width="25" height="25" viewBox="0 0 16 16" fill="currentColor"
    shapeRendering="crispEdges" aria-hidden="true"><path fillRule="evenodd" d={icons[action]} /></svg>;
}
