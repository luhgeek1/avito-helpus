import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { orbiHandlers } from '../orbi/server';
export const server = setupServer(...orbiHandlers);
beforeAll(() => {
  configure({ defaultHidden: true });
  server.listen({ onUnhandledFrame: 'error' });
  window.matchMedia = vi.fn().mockImplementation((media) => ({ media, matches: false, addEventListener() {}, removeEventListener() {} }));
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.getAnimations = () => [];
  Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} }) as unknown as Animation;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); server.resetHandlers(); localStorage.clear(); vi.restoreAllMocks(); document.cookie = 'csrf_token=; max-age=0'; });
afterAll(() => server.close());
