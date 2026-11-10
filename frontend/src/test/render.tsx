import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App, createQueryClient } from '../app/App'

/** Рендерит всё приложение на нужном адресе: роутер, Query и моки — как в браузере. */
export function renderApp(path = '/') {
  const history = createMemoryHistory({ initialEntries: [path] })
  const queryClient = createQueryClient()
  const user = userEvent.setup()
  const utils = render(<App history={history} queryClient={queryClient} />)
  return { ...utils, user, history, queryClient }
}

export { screen }
