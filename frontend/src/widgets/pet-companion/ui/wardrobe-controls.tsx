import type { WardrobePlacement } from "../model/use-wardrobe-placement";
const outline = "M16 0h24v4h8v4h4v8h4v24h-4v8h-4v4h-8v4H16v-4H8v-4H4v-8H0V16h4V8h4V4h8z";

export function WardrobeControls({ layout, move }: { layout: WardrobePlacement; move: (direction: number) => void }) {
  return (
    <div className="wardrobe-controls pointer-events-auto fixed flex gap-2" style={layout.controls}>
      {[-1, 1].map((direction) => (
        <button key={direction} type="button" className={`wardrobe-arrow relative grid size-9 touch-none place-items-center bg-transparent p-0
          focus-visible:drop-shadow-[0_0_3px_#00aaff]`}
          aria-label={direction < 0 ? "Предыдущий персонаж" : "Следующий персонаж"}
          onClick={() => move(direction)}>
          <svg className="absolute inset-0 size-full" viewBox="0 0 56 56" shapeRendering="crispEdges" aria-hidden="true">
            <path d={outline} fill="#383c62" /><path d={outline} transform="translate(3 3) scale(.892857)" fill="white" />
          </svg>
          <svg className="relative" width="18" height="18" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
            <path transform={direction > 0 ? "rotate(180 8 8)" : undefined}
              d="M10 3H8v2H6v2H4v2h2v2h2v2h2v-2H8V9H6V7h2V5h2z" fill="#383c62" />
          </svg>
        </button>
      ))}
    </div>
  );
}
