import { getResponse } from 'msw'
import { handlers } from './handlers'
import { API_BASE_URL } from '../client'

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
    const prefix = new URL(API_BASE_URL, window.location.origin).pathname
    if (!new URL(request.url).pathname.startsWith(`${prefix}/`)) return originalFetch(input, init)
    const mocked = await getResponse(handlers, request.clone())
    return mocked ?? originalFetch(request)
  }
}
