import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, type RouterHistory } from '@tanstack/react-router'
import { useState } from 'react'
import { createAppRouter } from './router'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: import.meta.env.MODE === 'test' ? false : 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

export function App({ history, queryClient }: { history?: RouterHistory; queryClient?: QueryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  const [router] = useState(() => createAppRouter(client, history))

  return (
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
