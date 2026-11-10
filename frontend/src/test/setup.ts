import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { handlers } from '../mocks/handlers'
import { resetDb } from '../mocks/db'
import { usePreferences } from '../stores/preferences'

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
