import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './index.css'

async function enableMocks() {
  if (import.meta.env.VITE_API_MOCKS === 'false') return
  const { worker, startFetchMocks } = await import('./mocks/browser')
  try {
    await worker.start({ onUnhandledFrame: 'bypass', quiet: true })
  } catch (error) {
    console.warn('[моки] Сервис-воркер недоступен, моки работают через перехват fetch.', error)
    startFetchMocks()
  }
}

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Приложение рендерится в любом случае: если моки не включились, экраны покажут ошибку загрузки
// с кнопкой «Повторить», а не пустую страницу.
void enableMocks()
  .catch((error: unknown) => console.error('[моки] Не удалось включить моки.', error))
  .finally(render)
