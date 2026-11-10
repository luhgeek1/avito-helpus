import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { server } from '../test/setup'
import { api, ApiError, request } from './client'

const schema = z.object({ value: z.number() })

describe('api client', () => {
  it('returns data validated by the schema', async () => {
    server.use(http.get('/api/thing', () => HttpResponse.json({ value: 42 })))
    await expect(api.get('/thing', schema)).resolves.toEqual({ value: 42 })
  })

  it('sends JSON body with POST', async () => {
    server.use(
      http.post('/api/thing', async ({ request: req }) => HttpResponse.json({ value: ((await req.json()) as { n: number }).n })),
    )
    await expect(api.post('/thing', schema, { n: 7 })).resolves.toEqual({ value: 7 })
  })

  it('throws ApiError with status on HTTP errors', async () => {
    server.use(http.delete('/api/thing', () => HttpResponse.json({}, { status: 503 })))
    const error = await api.delete('/thing', schema).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(503)
  })

  it('throws when the response does not match the contract', async () => {
    server.use(http.get('/api/thing', () => HttpResponse.json({ value: 'oops' })))
    await expect(request('GET', '/thing', schema)).rejects.toThrow('неожиданном формате')
  })

  it('throws a network error when the server is unreachable', async () => {
    server.use(http.get('/api/thing', () => HttpResponse.error()))
    const error = await api.get('/thing', schema).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(0)
  })
})
