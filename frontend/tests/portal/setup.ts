import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { handlers } from '@/shared/api/portal/testing'
import { resetDb } from '@/shared/api/portal/testing'
import { usePreferences } from '@/entities/portal'

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

export const server = setupServer(...handlers)

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
  // jsdom не умеет прокручивать окно, а роутер восстанавливает скролл.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetDb()
  localStorage.clear()
  usePreferences.setState(usePreferences.getInitialState(), true)
})

afterAll(() => server.close())
