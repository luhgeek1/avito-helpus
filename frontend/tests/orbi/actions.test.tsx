import { describe, expect, it } from "vitest";
import { actionPrompt, localDay, WORKPLACE_ACTIONS } from "@/features/orbi-chat/config/actions";

describe("workplace action drafts", () => {
  it("prepares explicit requests with dates, without sending medical details", () => {
    const values = { start: "2026-11-16", end: "2026-11-18", details: "  test  " };
    const prompts = WORKPLACE_ACTIONS.map(({ id }) => actionPrompt(id, values));
    expect(prompts).toEqual([
      "Оформи отпуск с 16.11.2026 по 18.11.2026", "Оформи отгул с 16.11.2026 по 18.11.2026",
      "Оформи уведомление о больничном с 16.11.2026 по 18.11.2026", "Нужен доступ к test",
      "Создай обращение в IT: test", "Передай наставнику вопрос: test", "Напиши команде: test",
    ]);
    expect(actionPrompt("sick", { start: "2026-11-16", end: "2026-11-16" })).not.toContain("undefined");
    expect(localDay(new Date(2026, 0, 2))).toBe("2026-01-02");
    expect(localDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
