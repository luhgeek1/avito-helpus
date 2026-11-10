import { getResponse } from 'msw'
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

/**
 * Запасной режим моков без сервис-воркера: подменяет `window.fetch` и отвечает теми же
 * обработчиками, что и воркер. Нужен там, где сервис-воркеры недоступны: приватное окно
 * Firefox, дев-сервер, открытый по IP без HTTPS, встроенные браузеры.
 * Запросы, для которых нет обработчика, уходят в сеть как обычно.
 */
export function startFetchMocks() {
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const request = new Request(input, init)
    const mocked = await getResponse(handlers, request.clone())
    return mocked ?? originalFetch(request)
  }
}
