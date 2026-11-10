import { delay, http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../api/client'
import type { SearchResult } from '../api/schemas'
import {
  banners,
  benefitArticles,
  benefitCategories,
  benefitServiceCategories,
  birthdays,
  calendarFor,
  me,
  people,
  promos,
  quickActions,
  services,
} from './data'
import { db, hydratePost } from './db'

const url = (path: string) => `${API_BASE_URL}${path}`
const latency = () => delay(import.meta.env.MODE === 'test' ? 0 : 250)
const notFound = () => HttpResponse.json({ message: 'Не найдено' }, { status: 404 })

const DAY = 86_400_000

function inPeriod(iso: string, period: string | null, now = new Date()): boolean {
  if (!period) return true
  const date = new Date(iso)
  if (period === 'today') return date.toDateString() === now.toDateString()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const days = period === 'week' ? 7 : 31
  return date.getTime() >= start.getTime() && date.getTime() < start.getTime() + days * DAY
}

const includes = (value: string, q: string) => value.toLowerCase().includes(q.toLowerCase())

export const handlers = [
  http.get(url('/me'), async () => {
    await latency()
    return HttpResponse.json(me)
  }),

  http.get(url('/people/:id'), async ({ params }) => {
    await latency()
    const person = people.find((item) => item.id === params.id)
    return person ? HttpResponse.json(person) : notFound()
  }),

  http.get(url('/banners'), async () => {
    await latency()
    return HttpResponse.json(banners)
  }),

  http.get(url('/quick-actions'), async () => {
    await latency()
    return HttpResponse.json(quickActions)
  }),

  http.get(url('/birthdays'), async () => {
    await latency()
    return HttpResponse.json(birthdays)
  }),

  http.get(url('/services'), async () => {
    await latency()
    return HttpResponse.json(services)
  }),

  http.get(url('/services/:id'), async ({ params }) => {
    await latency()
    const service = services.find((item) => item.id === params.id)
    return service ? HttpResponse.json(service) : notFound()
  }),

  http.get(url('/promos'), async () => {
    await latency()
    return HttpResponse.json(promos)
  }),

  http.get(url('/benefits'), async () => {
    await latency()
    return HttpResponse.json(benefitCategories)
  }),

  http.get(url('/benefits/:id'), async ({ params }) => {
    await latency()
    const id = String(params.id)
    const category = benefitCategories.find((item) => item.id === id)
    if (!category || !benefitArticles[id]) return notFound()
    const serviceCategories = benefitServiceCategories[id] ?? []
    return HttpResponse.json({
      ...category,
      services: services.filter((item) => serviceCategories.includes(item.category)),
      articles: benefitArticles[id].map((article) => ({ ...article, postId: `benefit-${article.id}` })),
    })
  }),

  http.get(url('/channels'), async () => {
    await latency()
    return HttpResponse.json(db.channels)
  }),

  http.post(url('/channels/:id/subscription'), async ({ params, request }) => {
    await latency()
    const channel = db.channels.find((item) => item.id === params.id)
    if (!channel) return notFound()
    const { subscribed } = (await request.json()) as { subscribed: boolean }
    if (channel.subscribed !== subscribed) {
      channel.subscribed = subscribed
      channel.subscribers += subscribed ? 1 : -1
    }
    return HttpResponse.json(channel)
  }),

  http.get(url('/posts'), async ({ request }) => {
    await latency()
    const channel = new URL(request.url).searchParams.get('channel')
    const list = db.posts
      .filter((post) => (channel ? post.channelId === channel : !post.id.startsWith('benefit-')))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map((post) => hydratePost(post.id))
    return HttpResponse.json(list)
  }),

  http.get(url('/posts/:id'), async ({ params }) => {
    await latency()
    const post = hydratePost(String(params.id))
    return post ? HttpResponse.json(post) : notFound()
  }),

  http.post(url('/posts/:id/like'), async ({ params, request }) => {
    await latency()
    const post = db.posts.find((item) => item.id === params.id)
    if (!post) return notFound()
    const { liked } = (await request.json()) as { liked: boolean }
    if (post.liked !== liked) {
      post.liked = liked
      post.likes += liked ? 1 : -1
    }
    return HttpResponse.json(hydratePost(post.id))
  }),

  http.get(url('/events'), async ({ request }) => {
    await latency()
    const params = new URL(request.url).searchParams
    const category = params.get('category')
    const format = params.get('format')
    const q = params.get('q')?.trim() ?? ''
    const list = db.events
      .filter((event) => !category || event.category === category)
      .filter((event) => !format || event.format === format)
      .filter((event) => !q || includes(event.title, q) || includes(event.description, q))
      .filter((event) => inPeriod(event.startsAt, params.get('period')))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    return HttpResponse.json(list)
  }),

  http.post(url('/events/:id/registration'), async ({ params }) => {
    await latency()
    const event = db.events.find((item) => item.id === params.id)
    if (!event) return notFound()
    if (event.seatsLeft === 0 && !event.registered) {
      return HttpResponse.json({ message: 'Мест нет' }, { status: 409 })
    }
    if (!event.registered) {
      event.registered = true
      if (event.seatsLeft !== null) event.seatsLeft -= 1
    }
    return HttpResponse.json(event)
  }),

  http.delete(url('/events/:id/registration'), async ({ params }) => {
    await latency()
    const event = db.events.find((item) => item.id === params.id)
    if (!event) return notFound()
    if (event.registered) {
      event.registered = false
      if (event.seatsLeft !== null) event.seatsLeft += 1
    }
    return HttpResponse.json(event)
  }),

  http.get(url('/notifications'), async () => {
    await latency()
    return HttpResponse.json(db.notifications)
  }),

  http.post(url('/notifications/read-all'), async () => {
    await latency()
    db.notifications.forEach((item) => {
      item.read = true
    })
    return HttpResponse.json({ ok: true })
  }),

  http.get(url('/calendar'), async ({ request }) => {
    await latency()
    const date = new URL(request.url).searchParams.get('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return HttpResponse.json({ message: 'Нужен параметр date' }, { status: 400 })
    }
    return HttpResponse.json(calendarFor(date))
  }),

  http.get(url('/search'), async ({ request }) => {
    await latency()
    const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
    if (!q) return HttpResponse.json([])
    const peopleList = [...people, ...birthdays.map((item) => item.person)]
    const results: SearchResult[] = [
      ...peopleList
        .filter((p) => includes(`${p.firstName} ${p.lastName}`, q) || includes(p.position, q))
        .map((p) => ({
          type: 'person' as const,
          id: p.id,
          title: `${p.firstName} ${p.lastName}`,
          subtitle: p.position,
          href: people.some((item) => item.id === p.id) ? `/people/${p.id}` : '/',
        })),
      ...services
        .filter((s) => includes(s.title, q) || includes(s.description, q))
        .map((s) => ({ type: 'service' as const, id: s.id, title: s.title, subtitle: s.description, href: `/services/${s.id}` })),
      ...db.events
        .filter((e) => includes(e.title, q))
        .map((e) => ({ type: 'event' as const, id: e.id, title: e.title, subtitle: e.place, href: '/events' })),
      ...db.posts
        .filter((p) => includes(p.title, q) || includes(p.lead, q))
        .map((p) => ({ type: 'post' as const, id: p.id, title: p.title, subtitle: p.lead, href: `/feed/${p.id}` })),
    ]
    return HttpResponse.json(results)
  }),



  http.post(url('/feedback'), async ({ request }) => {
    await latency()
    const { value } = (await request.json()) as { value: 'like' | 'dislike' }
    db.feedback.push(value)
    return HttpResponse.json({ ok: true })
  }),
]
