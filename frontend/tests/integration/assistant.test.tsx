import { act, render, renderHook, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { useIntegrationAssistant, GuideMessages } from "@/features/integration-assistant";
import { answerInstallationQuestion } from "@/features/integration-assistant/model/answer";
import { useOrbiChat } from "@/features/orbi-chat";
import { useCompanionChat } from "@/widgets/pet-companion/model/use-companion-chat";

it("answers setup and specific errors from documentation, retains context and admits missing knowledge", () => {
  expect(answerInstallationQuestion("Привет!").text).toMatch(/Помогу установить/);
  expect(answerInstallationQuestion("Хочу установить Docker").topics).toContain("start");
  expect(answerInstallationQuestion("Как встроить в Next.js?").topics).toContain("react");
  expect(answerInstallationQuestion("Ошибка API 401").topics).toEqual(["auth"]);
  expect(answerInstallationQuestion("API возвращает 502").topics).toEqual(["api"]);
  expect(answerInstallationQuestion("SSE буферизуется").topics).toEqual(["api"]);
  expect(answerInstallationQuestion("А где это указать?", ["api"]).topics).toEqual(["api"]);
  expect(answerInstallationQuestion("А дальше?", ["start"]).topics).toEqual(["react"]);
  expect(answerInstallationQuestion("Следующий шаг?", ["start"]).topics).toEqual(["react"]);
  expect(answerInstallationQuestion("Дальше?", ["check"]).topics).toEqual(["check"]);
  expect(answerInstallationQuestion("Что завтра на обед?").topics).toEqual([]);
  expect(answerInstallationQuestion("Что завтра на обед?").text).toMatch(/нет точного ответа/);
});

it("keeps installation conversations separate from authenticated workspace messages", () => {
  const guide = useIntegrationAssistant.getState();
  expect(guide.send("   ")).toBeUndefined();
  guide.setDraft("Как встроить в Next.js?");
  guide.send();
  expect(useIntegrationAssistant.getState().draft).toBe("");
  expect(useIntegrationAssistant.getState().messages).toHaveLength(2);
  guide.ask("А где это указать?");
  expect(useIntegrationAssistant.getState().openSignal).toBe(1);
  expect(useIntegrationAssistant.getState().messages.at(-1)?.topics).toEqual(["react"]);
  expect(useOrbiChat.getState().messages).toEqual([]);
  guide.startOver();
  expect(useIntegrationAssistant.getState().messages).toEqual([]);
});

it("returns guide replies to Spotlight without a backend session and ignores empty drafts", async () => {
  const { result } = renderHook(() => useCompanionChat(true));
  expect(await result.current.send()).toBeUndefined();
  act(() => result.current.setDraft("Как подключить LLM?"));
  await act(async () => { const reply = await result.current.send(); expect(reply?.parts[0]).toMatchObject({ type: "text", text: expect.stringContaining("LLM_API_KEY") }); });
  await result.current.load();
  expect(result.current.authenticated).toBe(true);
  expect(useOrbiChat.getState().messages).toEqual([]);
});

it("uses source links for prose-only answers and offers an honest fallback", () => {
  useIntegrationAssistant.getState().send("401");
  useIntegrationAssistant.getState().send("Что завтра на обед?");
  render(<GuideMessages name="Орби" />);
  expect(screen.getByRole("link", { name: /Вход, SSO и права/ })).toHaveAttribute("href", "/#auth");
  expect(screen.getByText(/В руководстве нет точного ответа/)).toBeInTheDocument();
});
