import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { defaultPet, PetPreferencesProvider, spriteGrid, usePetPreferences } from "@/entities/pet";
import { readChosenPet, readFavoritePetIds, saveFavoritePetIds } from "@/entities/pet/lib/pet-storage";
import { PetOnboardingProvider, usePetOnboarding } from "@/features/pet/onboarding";
import { usePetGreeting } from "@/features/pet/greet";
import { WorkspaceShell } from "@/widgets/workspace-shell";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it("restores only known favorites and removes duplicates without changing the selected pet", () => {
  localStorage.setItem("buddy-pet", "orbit");
  localStorage.setItem("buddy-favorites", JSON.stringify(["orbi-neo", "orbi-neo", "unknown", 5, "orbit"]));
  expect(readFavoritePetIds()).toEqual(["orbi-neo", "orbit"]);
  expect(readChosenPet()).toBe("orbit");
});

it("recovers from blocked and corrupt storage while preserving a usable in-memory pet selection", () => {
  localStorage.setItem("buddy-favorites", "broken");
  expect(readFavoritePetIds()).toEqual([]);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(readChosenPet()).toBeNull();
  expect(readFavoritePetIds()).toEqual([]);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(() => saveFavoritePetIds(["orbit"])).not.toThrow();
  const { result } = renderHook(() => ({ preferences: usePetPreferences(), tour: usePetOnboarding() }), {
    wrapper: ({ children }) => <PetPreferencesProvider><PetOnboardingProvider>{children}</PetOnboardingProvider></PetPreferencesProvider>,
  });
  expect(result.current.preferences.chosenPet?.id).toBe("orbit");
  act(() => result.current.tour.finish());
  expect(result.current.tour.active).toBe(false);
});

it("extends a repeated greeting and removes it after the final timeout", () => {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(() => usePetGreeting());
  act(() => result.current.greet());
  act(() => vi.advanceTimersByTime(6000));
  expect(result.current.speaking).toBe(true);
  act(() => result.current.greet());
  act(() => vi.advanceTimersByTime(6000));
  expect(result.current.speaking).toBe(true);
  act(() => vi.advanceTimersByTime(500));
  expect(result.current.speaking).toBe(false);
  act(() => result.current.greet());
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("rejects an unknown mascot instead of drawing the wrong companion", () => {
  expect(() => spriteGrid({ ...defaultPet, id: "unknown", category: "mascots", orbiDesign: undefined }, 0)).toThrow("Unknown mascot sprite: unknown");
});

it("keeps gallery shell navigation and its skip link keyboard accessible", () => {
  const navigate = vi.fn();
  render(<WorkspaceShell page="pets" navigate={navigate} companion={null}><main id="main-content">Content</main></WorkspaceShell>);
  fireEvent.click(screen.getByRole("link", { name: "Avito buddy — главная" }));
  fireEvent.click(screen.getByRole("link", { name: "Главная" }));
  fireEvent.click(screen.getByRole("link", { name: /^Галерея петов/ }));
  expect(navigate.mock.calls.map(([page]) => page)).toEqual(["home", "home", "pets"]);
  fireEvent.click(screen.getByRole("link", { name: "К содержимому" }));
  expect(screen.getByRole("main")).toHaveFocus();
});
