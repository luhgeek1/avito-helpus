import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { PetPreferencesProvider } from "@/entities/pet";
import { PetOnboardingProvider } from "@/features/pet/onboarding";
import { useCompanionTour } from "@/widgets/pet-companion/model/use-companion-tour";
import type { CompanionTour } from "@/widgets/pet-companion/model/use-companion-tour";
import { CompanionTourShell } from "@/widgets/pet-companion/ui/companion-tour";
import { useWardrobePlacement } from "@/widgets/pet-companion/model/use-wardrobe-placement";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function Wrapper({ children }: { children: ReactNode }) {
  return <PetPreferencesProvider><PetOnboardingProvider>{children}</PetOnboardingProvider></PetPreferencesProvider>;
}

it("visits every tour scene, opens its real control, preserves manual dragging and completes", async () => {
  vi.useFakeTimers();
  const anchor = document.createElement("div");
  const button = document.createElement("button"); button.className = "widget-pet";
  anchor.append(button);
  const rect = { left: 20, top: 30, width: 160, height: 128, right: 180, bottom: 158, x: 20, y: 30, toJSON() {} };
  vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(rect);
  const controls = {
    movement: { ref: { current: anchor }, style: {}, dragging: false, relocate: vi.fn() },
    actions: { dismiss: vi.fn(), menu: vi.fn(), chat: vi.fn(), wardrobe: vi.fn(), settings: vi.fn() },
    spotlight: { close: vi.fn(), show: vi.fn() }, show: vi.fn(), silence: vi.fn(), draft: "",
  };
  const { result, rerender } = renderHook(() => useCompanionTour(controls as unknown as Parameters<typeof useCompanionTour>[0]), { wrapper: Wrapper });
  expect(result.current.scene).toBe("intro");
  act(() => vi.advanceTimersByTime(1000));
  act(() => result.current.next());
  expect(result.current.scene).toBe("menu");
  act(() => vi.advanceTimersByTime(1000));
  expect(controls.actions.menu).toHaveBeenCalled();
  for (const scene of ["chat", "wardrobe", "settings"] as const) {
    act(() => result.current.visit(scene));
    act(() => vi.advanceTimersByTime(1000));
    expect(controls.actions[scene]).toHaveBeenCalled();
  }
  vi.stubGlobal("innerWidth", 375);
  act(() => window.dispatchEvent(new Event("resize")));
  act(() => result.current.visit("spotlight"));
  act(() => vi.advanceTimersByTime(1000));
  expect(controls.spotlight.show).toHaveBeenCalled();
  act(() => result.current.next());
  expect(result.current.scene).toBe("move");
  controls.movement.dragging = true;
  rerender();
  act(() => result.current.dragged());
  act(() => result.current.next());
  await act(async () => { await Promise.resolve(); });
  expect(result.current.active).toBe(false);
  expect(localStorage.getItem("buddy-onboarding-v1")).toBe("done");
});

it("uses the right-hand semicircle for the wardrobe tour and fits it in the viewport", () => {
  vi.stubGlobal("innerWidth", 375); vi.stubGlobal("innerHeight", 812);
  const anchor = document.createElement("div");
  vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({ left: 8, top: 250, width: 144, height: 96 } as DOMRect);
  const reference = { current: anchor };
  const { result } = renderHook(() => useWardrobePlacement(reference, {}, true));
  expect(result.current).toMatchObject({ semicircle: true, horizontal: 1, vertical: 1, size: 48 });
  expect(result.current!.cx + result.current!.radius + result.current!.size / 2).toBeLessThanOrEqual(375 - 16);
});

function fakeTour(overrides: Partial<CompanionTour> = {}): CompanionTour {
  return { active: true, scene: "intro", text: "Tour text", viewport: { width: 1440, height: 900 }, scale: 3,
    closing: false, next: vi.fn(), finish: vi.fn(), visit: vi.fn(), dragged: vi.fn(), ...overrides };
}

it("advances by background click or space, ignores input and held space, and handles native cancel", () => {
  vi.useFakeTimers();
  const tour = fakeTour();
  const { rerender, unmount } = render(<Wrapper><CompanionTourShell tour={tour} hideCopy={false}><input aria-label="Draft" /></CompanionTourShell></Wrapper>);
  const dialog = screen.getByRole("dialog", { name: "Знакомство с петом" });
  expect(document.body).toHaveClass("overflow-hidden");
  act(() => vi.advanceTimersByTime(300));
  fireEvent.click(dialog);
  expect(tour.next).toHaveBeenCalledOnce();
  fireEvent.keyDown(screen.getByRole("textbox"), { key: " " });
  fireEvent.keyDown(dialog, { key: " ", repeat: true });
  expect(tour.next).toHaveBeenCalledOnce();
  act(() => vi.advanceTimersByTime(300));
  fireEvent.keyDown(dialog, { key: " " });
  expect(tour.next).toHaveBeenCalledTimes(2);
  fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
  expect(tour.finish).toHaveBeenCalledOnce();
  rerender(<Wrapper><CompanionTourShell tour={{ ...tour, closing: true }} hideCopy={false}>Content</CompanionTourShell></Wrapper>);
  fireEvent.click(dialog);
  expect(tour.next).toHaveBeenCalledTimes(2);
  unmount();
  expect(document.body).not.toHaveClass("overflow-hidden");
});
