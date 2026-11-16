export type Position = { x: number; y: number };
export type ChatBoundary = { left: number; top: number; width: number; height: number };

export function hasCompanionSpace(size: { width: number; height: number },
  viewport: { width: number; height: number }, chat: ChatBoundary | null): boolean {
  return !chat || chat.left >= size.width + 16 || chat.left + chat.width <= viewport.width - size.width - 16
    || chat.top >= size.height + 16 || chat.top + chat.height <= viewport.height - size.height - 16;
}

export function avoidChat(next: Position, origin: Position | null, size: { width: number; height: number },
  viewport: { width: number; height: number }, chat: ChatBoundary | null): Position {
  const maxX = Math.max(8, viewport.width - size.width - 8);
  const maxY = Math.max(8, viewport.height - size.height - 8);
  const target = { x: Math.round(Math.max(8, Math.min(next.x, maxX))),
    y: Math.round(Math.max(8, Math.min(next.y, maxY))) };
  if (!chat) return target;
  // Expand the obstacle by the pet's size so collision becomes a point test.
  const left = chat.left - size.width - 8, right = chat.left + chat.width + 8;
  const top = chat.top - size.height - 8, bottom = chat.top + chat.height + 8;
  const inside = (point: Position) => point.x > left && point.x < right && point.y > top && point.y < bottom;
  if (origin && !inside(origin)) {
    const dx = target.x - origin.x, dy = target.y - origin.y;
    const interval = (start: number, delta: number, min: number, max: number) => delta === 0
      ? start > min && start < max ? [-Infinity, Infinity] : [Infinity, -Infinity]
      : [Math.min((min - start) / delta, (max - start) / delta), Math.max((min - start) / delta, (max - start) / delta)];
    const [enterX, exitX] = interval(origin.x, dx, left, right);
    const [enterY, exitY] = interval(origin.y, dy, top, bottom);
    const enter = Math.max(enterX, enterY), exit = Math.min(exitX, exitY);
    // Sweep the whole segment: a single fast pointer event cannot tunnel through the chat.
    if (enter >= 0 && enter < 1 && enter < exit) {
      if (enterX >= enterY) target.x = dx > 0 ? Math.floor(left) : Math.ceil(right);
      if (enterY >= enterX) target.y = dy > 0 ? Math.floor(top) : Math.ceil(bottom);
      return target;
    }
  }
  if (!inside(target)) return target;
  // Opening, moving or resizing the chat can cover a stationary pet. Use the nearest free edge.
  const candidates = [{ x: Math.floor(left), y: target.y }, { x: Math.ceil(right), y: target.y },
    { x: target.x, y: Math.floor(top) }, { x: target.x, y: Math.ceil(bottom) }]
    .filter(point => point.x >= 8 && point.x <= maxX && point.y >= 8 && point.y <= maxY);
  candidates.sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y));
  return candidates[0] ?? origin ?? target;
}
