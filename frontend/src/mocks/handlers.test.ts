import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { api, ApiError } from '../api/client'
import {
  benefitCategoryDetailSchema,
  calendarItemSchema,
  channelSchema,
  eventSchema,
  okSchema,
  postSchema,
  searchResultSchema,
} from '../api/schemas'

const events = z.array(eventSchema)

describe('mock API', () => {
  it('filters events by category, format, query and period', async () => {
    const all = await api.get('/events', events)
    expect(all.length).toBeGreaterThan(5)
    expect(all.map((e) => e.startsAt)).toEqual([...all.map((e) => e.startsAt)].sort())

    const sport = await api.get('/events?category=sport', events)
    expect(sport.every((e) => e.category === 'sport')).toBe(true)

    const online = await api.get('/events?format=online', events)
    expect(online.every((e) => e.format === 'online')).toBe(true)

    const yoga = await api.get('/events?q=йога', events)
    expect(yoga.map((e) => e.id)).toEqual(['ev-4'])

    const today = await api.get('/events?period=today', events)
    expect(today.map((e) => e.id)).toContain('ev-4')
    const week = await api.get('/events?period=week', events)
    expect(week.map((e) => e.id)).not.toContain('ev-10')
    const month = await api.get('/events?period=month', events)
    expect(month.length).toBeGreaterThanOrEqual(week.length)
  })

  it('registers and unregisters for an event', async () => {
    const registered = await api.post('/events/ev-5/registration', eventSchema)
    expect(registered).toMatchObject({ registered: true, seatsLeft: 39 })
    const again = await api.post('/events/ev-5/registration', eventSchema)
    expect(again.seatsLeft).toBe(39)
    const cancelled = await api.delete('/events/ev-5/registration', eventSchema)
    expect(cancelled).toMatchObject({ registered: false, seatsLeft: 40 })
  })

  it('rejects registration when there are no seats and unknown events', async () => {
    const { db } = await import('./db')
    db.events.find((e) => e.id === 'ev-8')!.seatsLeft = 0
    await expect(api.post('/events/ev-8/registration', eventSchema)).rejects.toMatchObject({ status: 409 })
    await expect(api.post('/events/nope/registration', eventSchema)).rejects.toMatchObject({ status: 404 })
    await expect(api.delete('/events/nope/registration', eventSchema)).rejects.toMatchObject({ status: 404 })
  })

  it('toggles channel subscription and post likes', async () => {
    const channel = await api.post('/channels/tech/subscription', channelSchema, { subscribed: true })
    expect(channel).toMatchObject({ subscribed: true, subscribers: 6351 })
    const post = await api.post('/posts/post-1/like', postSchema, { liked: true })
    expect(post).toMatchObject({ liked: true, likes: 25 })
    const unliked = await api.post('/posts/post-1/like', postSchema, { liked: false })
    expect(unliked.likes).toBe(24)
    await expect(api.post('/channels/x/subscription', channelSchema, { subscribed: true })).rejects.toBeInstanceOf(ApiError)
    await expect(api.post('/posts/x/like', postSchema, { liked: true })).rejects.toMatchObject({ status: 404 })
  })

  it('separates benefit posts from the main feed', async () => {
    const feed = await api.get('/posts', z.array(postSchema))
    expect(feed.some((p) => p.id.startsWith('benefit-'))).toBe(false)
    const plus = await api.get('/posts?channel=plus', z.array(postSchema))
    expect(plus.every((p) => p.channel.id === 'plus')).toBe(true)
  })

  it('returns benefit categories with services and articles', async () => {
    const savings = await api.get('/benefits/savings', benefitCategoryDetailSchema)
    expect(savings.services.length).toBeGreaterThan(0)
    expect(savings.articles[0].postId).toMatch(/^benefit-/)
    await expect(api.get('/benefits/events', benefitCategoryDetailSchema)).rejects.toMatchObject({ status: 404 })
  })

  it('searches across people, services, events and posts', async () => {
    const results = await api.get('/search?q=Белов', z.array(searchResultSchema))
    expect(results[0]).toMatchObject({ type: 'person', href: '/people/p-artem' })
    const birthday = await api.get('/search?q=Гришина', z.array(searchResultSchema))
    expect(birthday[0].href).toBe('/')
    const mixed = await api.get('/search?q=отпуск', z.array(searchResultSchema))
    expect(mixed.some((r) => r.type === 'service')).toBe(true)
    const event = await api.get('/search?q=забег', z.array(searchResultSchema))
    expect(event[0].type).toBe('event')
    const empty = await api.get('/search?q=', z.array(searchResultSchema))
    expect(empty).toEqual([])
  })

  it('validates calendar date and marks notifications read', async () => {
    const items = await api.get('/calendar?date=2026-11-10', z.array(calendarItemSchema))
    expect(items[0].start).toBe('2026-11-10T10:00:00')
    await expect(api.get('/calendar', z.array(calendarItemSchema))).rejects.toMatchObject({ status: 400 })
    await expect(api.post('/notifications/read-all', okSchema)).resolves.toEqual({ ok: true })
  })

  it('stores feedback', async () => {
    await expect(api.post('/feedback', okSchema, { value: 'like' })).resolves.toEqual({ ok: true })
  })

  it('returns 404 for unknown entities', async () => {
    await expect(api.get('/people/nobody', okSchema)).rejects.toMatchObject({ status: 404 })
    await expect(api.get('/services/nothing', okSchema)).rejects.toMatchObject({ status: 404 })
    await expect(api.get('/posts/nothing', okSchema)).rejects.toMatchObject({ status: 404 })
  })
})

