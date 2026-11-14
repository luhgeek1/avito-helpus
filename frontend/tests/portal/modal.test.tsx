import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import { Modal } from "@/shared/ui/portal";

function Harness() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Open modal</button>
    {open && <Modal title="Test modal" onClose={() => setOpen(false)}><input aria-label="Name" /><button>Last action</button></Modal>}</>;
}

it("focuses the modal, contains Tab navigation and returns focus on Escape", async () => {
  const user = userEvent.setup();
  render(<div className="isolate" data-testid="portal"><Harness /></div>);
  const trigger = screen.getByRole("button", { name: "Open modal" });
  await user.click(trigger);
  const close = screen.getByRole("button", { name: "Закрыть" });
  expect(screen.getByTestId("portal")).not.toContainElement(screen.getByRole("dialog"));
  expect(close).toHaveFocus();
  await user.tab({ shift: true });
  expect(screen.getByRole("button", { name: "Last action" })).toHaveFocus();
  await user.tab();
  expect(close).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
