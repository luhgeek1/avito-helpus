export type CompanionAction = "chat" | "wardrobe" | "settings";

const outline = "#383c62";

export function PixelActionIcon({ action }: { action: CompanionAction }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true">
    {action === "chat" && <>
      <path fill={outline} d="M3 3h18v1h1v13h-1v1H10v2H8v2H5v-4H2V4h1z" />
      <path fill="#00aaff" d="M4 5h16v11H9v2H7v-2H4z" />
      <path fill="#ffffff" d="M6 9h3v3H6z M11 9h3v3h-3z M16 9h2v3h-2z" />
    </>}
    {action === "wardrobe" && <>
      <path fill={outline} d="M7 3h3v2h4V3h3v1h3v2h2v6h-4v9H6v-9H2V6h2V4h3z" />
      <path fill="#02d15c" d="M7 5h1v2h8V5h1v1h3v4h-4v9H8v-9H4V8h2V6h1z" />
      <path fill="#965eeb" d="M8 5h2v2h4V5h2v4H8z" />
      <path fill="#ff4053" d="M12 11h3v4h-3z" />
    </>}
    {action === "settings" && <>
      <path fill={outline} d="M9 1h6v3h2V3h3v3h-1v3h3v6h-3v3h1v3h-3v-1h-2v3H9v-3H7v1H4v-3h1v-3H2V9h3V6H4V3h3v1h2z" />
      <path fill="#965eeb" d="M11 3h2v3h4V5h1v3h-1v3h3v2h-3v3h1v3h-1v-1h-4v3h-2v-3H7v1H6v-3h1v-3H4v-2h3V8H6V5h1v1h4z" />
      <path fill={outline} d="M9 7h6v2h2v6h-2v2H9v-2H7V9h2z" />
      <path fill="#ffffff" d="M10 10h4v4h-4z" />
    </>}
  </svg>;
}
