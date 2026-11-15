import { expect, it } from "vitest";
import { useIntegrationAssistant } from "@/features/integration-assistant";
import { answerInstallationQuestion } from "@/features/integration-assistant/model/answer";
import { useOrbiChat } from "@/features/orbi-chat";

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
