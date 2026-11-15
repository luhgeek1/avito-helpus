import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { CodeBlock } from "@/shared/ui/code-block";

const commands = "cp .env.example .env\ndocker compose up -d --build";
afterEach(() => vi.restoreAllMocks());

it("shows code, copies exact text and recovers when browser clipboard access is denied", async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const view = render(<CodeBlock code={commands} language="bash" title="Commands" />);
  await user.click(screen.getByRole("button", { name: /Скопировать код/ }));
  expect(writeText).toHaveBeenCalledWith(commands);
  expect(screen.getByText("Скопировано")).toBeInTheDocument();
  writeText.mockRejectedValueOnce(new Error("denied"));
  await user.click(screen.getByRole("button", { name: /Скопировать код/ }));
  expect(screen.getByRole("status")).toHaveTextContent("Выдели код");
  view.rerender(<CodeBlock code={'// Comment\nconst value = "safe";\nreturn false;'} language="ts" title="Commands" />);
  expect(screen.getByText("// Comment")).toBeInTheDocument();
});
