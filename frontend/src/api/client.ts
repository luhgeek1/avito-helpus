import type { z } from 'zod'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * Единая точка обращения к бэкенду. Ответ всегда валидируется Zod-схемой,
 * поэтому расхождение контракта с бэкендом видно сразу, а не в глубине UI.
 */
export async function request<S extends z.ZodType>(
  method: Method,
  path: string,
  schema: S,
  body?: unknown,
): Promise<z.infer<S>> {
  let response: Response
  try {
    response = await fetch(new URL(`${API_BASE_URL}${path}`, window.location.origin), {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    })
  } catch {
    throw new ApiError(0, 'Нет соединения с сервером')
  }

  if (!response.ok) {
    throw new ApiError(response.status, `Ошибка сервера (${response.status})`)
  }

  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) {
    throw new ApiError(response.status, 'Сервер вернул данные в неожиданном формате')
  }
  return parsed.data
}

export const api = {
  get: <S extends z.ZodType>(path: string, schema: S) => request('GET', path, schema),
  post: <S extends z.ZodType>(path: string, schema: S, body?: unknown) =>
    request('POST', path, schema, body ?? {}),
  delete: <S extends z.ZodType>(path: string, schema: S) => request('DELETE', path, schema),
}
