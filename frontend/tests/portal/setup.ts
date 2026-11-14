import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { handlers } from '@/shared/api/portal/testing'
import { resetDb } from '@/shared/api/portal/testing'
import { usePreferences } from '@/entities/portal'
import { resetSessionForTests, useOrbiNotice } from '@/shared/api'
import { useOrbiChat } from '@/features/orbi-chat'
import { orbiHandlers } from '../orbi/server'

vi.mock('next/navigation', async () => {
  const state = await import('./navigation');
  return { useRouter: () => state.navigation, usePathname: () => state.useLocation().pathname,
    useSearchParams: () => state.useLocation().searchParams, useParams: state.useParams };
});
vi.mock('next/link', async () => {
  const { createElement } = await import('react');
  const { navigation } = await import('./navigation');
  return { default: ({ href, onClick, children, ...rest }: import('react').AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement('a', { ...rest, href, onClick: (event: import('react').MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented && href?.startsWith('/')) { event.preventDefault(); navigation.push(href); }
    } }, children) };
});

export const server = setupServer(...handlers, ...orbiHandlers)

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
  // jsdom не умеет прокручивать окно, а роутер восстанавливает скролл.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
  Element.prototype.scrollIntoView = vi.fn()
  // Browser APIs the companion uses and jsdom lacks.
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  // Tailwind's `contents` keeps the closed tour <dialog> (the companion's wrapper) visible in browsers.
  const style = document.createElement('style')
  style.textContent = 'dialog.contents { display: contents; }'
  document.head.append(style)
  Element.prototype.getAnimations ??= () => []
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.animate ??= function () {
    return { finished: Promise.resolve(), cancel() {}, finish() {}, onfinish: null, addEventListener() {} } as unknown as Animation
  }
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true }
  HTMLDialogElement.prototype.show ??= function (this: HTMLDialogElement) { this.open = true }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false }
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetDb()
  localStorage.clear()
  usePreferences.setState(usePreferences.getInitialState(), true)
  resetSessionForTests()
  useOrbiChat.getState().clear()
  useOrbiNotice.setState({ notice: null })
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
})

afterAll(() => server.close())
