import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RequestCardView } from "@/features/orbi-chat/ui/cards";
import { WorkplaceActionForm } from "@/features/orbi-chat/ui/action-form";
import { WorkplaceActions, useOrbiChat } from "@/features/orbi-chat";
import { signIn } from "./server";
import { describe, expect, it, vi } from "vitest";
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

describe("workplace forms", () => {
  it("validates empty input and dates and keeps sending separate from preparation", () => {
    const prepare = vi.fn();
    const back = vi.fn();
    const { rerender } = render(<WorkplaceActionForm id="vacation" busy={false} onBack={back} onPrepare={prepare} />);
    fireEvent.submit(screen.getByRole("form"));
    expect(screen.getByRole("alert")).toHaveTextContent("Заполни все поля");
    fireEvent.change(screen.getByLabelText("С"), { target: { value: "2000-01-01" } });
    fireEvent.change(screen.getByLabelText("По"), { target: { value: "2000-01-02" } });
    fireEvent.submit(screen.getByRole("form"));
    expect(screen.getByRole("alert")).toHaveTextContent("Проверь даты");
    fireEvent.change(screen.getByLabelText("С"), { target: { value: "2090-01-02" } });
    fireEvent.change(screen.getByLabelText("По"), { target: { value: "2090-01-01" } });
    fireEvent.submit(screen.getByRole("form"));
    expect(prepare).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("По"), { target: { value: "2090-01-03" } });
    fireEvent.submit(screen.getByRole("form"));
    expect(prepare).toHaveBeenCalledWith("Оформи отпуск с 02.01.2090 по 03.01.2090");
    fireEvent.click(screen.getByRole("button", { name: /Все действия/ }));
    expect(back).toHaveBeenCalledOnce();
    rerender(<WorkplaceActionForm id="sick" busy onBack={back} onPrepare={prepare} />);
    expect(screen.getByRole("button", { name: /Подготовить/ })).toBeDisabled();
  });

  it("opens every action, returns to the list and sends read-only questions", async () => {
    signIn();
    const done = vi.fn();
    render(<WorkplaceActions onDone={done} />);
    for (const action of WORKPLACE_ACTIONS) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${action.title}`) }));
      expect(screen.getByRole("form", { name: action.title })).toBeInTheDocument();
      if (action.fields[0].key === "details") {
        fireEvent.change(screen.getByLabelText(action.fields[0].label), { target: { value: " test " } });
        fireEvent.submit(screen.getByRole("form"));
        await waitFor(() => expect(useOrbiChat.getState().busy).toBe(false));
        expect(useOrbiChat.getState().messages.some((m) => m.role === "user")).toBe(true);
      }
      fireEvent.click(screen.getByRole("button", { name: /Все действия/ }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Покажи мои встречи на неделю" }));
    await waitFor(() => expect(useOrbiChat.getState().busy).toBe(false));
    expect(done).toHaveBeenCalledTimes(5);
  });
});


it("prepares request controls from a result card without performing them immediately", async () => {
  signIn();
  render(<RequestCardView data={{ id: "request-1", kind: "access", title: "Grafana", status: "submitted", status_title: "На согласовании", external_id: "ACC-1042", approver: null, decision_comment: null, sla_due_at: null }} />);
  fireEvent.click(screen.getByRole("button", { name: "Отменить заявку" }));
  await waitFor(() => expect(useOrbiChat.getState().busy).toBe(false));
  expect(useOrbiChat.getState().messages[0].parts).toContainEqual(expect.objectContaining({ text: "Отмени заявку ACC-1042" }));
  fireEvent.click(screen.getByRole("button", { name: "Напомнить" }));
  await waitFor(() => expect(useOrbiChat.getState().busy).toBe(false));
  expect(useOrbiChat.getState().messages.at(-2)?.parts).toContainEqual(expect.objectContaining({ text: "Напомни о заявке ACC-1042" }));
});
