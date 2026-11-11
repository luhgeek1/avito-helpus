import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from './client'
import {
  bannerSchema,
  benefitCategoryDetailSchema,
  benefitCategorySchema,
  birthdaySchema,
  calendarItemSchema,
  channelSchema,
  eventSchema,
  notificationSchema,
  okSchema,
  personSchema,
  postSchema,
  promoSchema,
  quickActionSchema,
  searchResultSchema,
  serviceSchema,
  type Channel,
  type CompanyEvent,
  type EventCategory,
  type EventFormat,
  type Post,
} from './schemas'

export type EventsFilter = {
  category?: EventCategory
  format?: EventFormat
  period?: 'today' | 'week' | 'month'
  q?: string
}

export const queryKeys = {
  me: ['me'] as const,
  person: (id: string) => ['people', id] as const,
  banners: ['banners'] as const,
  quickActions: ['quick-actions'] as const,
  birthdays: ['birthdays'] as const,
  services: ['services'] as const,
  service: (id: string) => ['services', id] as const,
  promos: ['promos'] as const,
  benefits: ['benefits'] as const,
  benefit: (id: string) => ['benefits', id] as const,
  channels: ['channels'] as const,
  posts: (channel?: string) => ['posts', { channel }] as const,
  post: (id: string) => ['post', id] as const,
  events: (filter: EventsFilter) => ['events', filter] as const,
  notifications: ['notifications'] as const,
  calendar: (date: string) => ['calendar', date] as const,
  search: (q: string) => ['search', q] as const,
}

function toQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const str = search.toString()
  return str ? `?${str}` : ''
}

export const useMe = () =>
  useQuery({ queryKey: queryKeys.me, queryFn: () => api.get('/me', personSchema) })

export const usePerson = (id: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.person(id),
    queryFn: () => api.get(`/people/${encodeURIComponent(id)}`, personSchema),
    enabled,
  })

export const useBanners = () =>
  useQuery({ queryKey: queryKeys.banners, queryFn: () => api.get('/banners', z.array(bannerSchema)) })

export const useQuickActions = () =>
  useQuery({
    queryKey: queryKeys.quickActions,
    queryFn: () => api.get('/quick-actions', z.array(quickActionSchema)),
  })

export const useBirthdays = () =>
  useQuery({
    queryKey: queryKeys.birthdays,
    queryFn: () => api.get('/birthdays', z.array(birthdaySchema)),
  })

export const useServices = () =>
  useQuery({
    queryKey: queryKeys.services,
    queryFn: () => api.get('/services', z.array(serviceSchema)),
  })

export const useService = (id: string) =>
  useQuery({
    queryKey: queryKeys.service(id),
    queryFn: () => api.get(`/services/${encodeURIComponent(id)}`, serviceSchema),
  })

export const usePromos = () =>
  useQuery({ queryKey: queryKeys.promos, queryFn: () => api.get('/promos', z.array(promoSchema)) })

export const useBenefitCategories = () =>
  useQuery({
    queryKey: queryKeys.benefits,
    queryFn: () => api.get('/benefits', z.array(benefitCategorySchema)),
  })

export const useBenefitCategory = (id: string) =>
  useQuery({
    queryKey: queryKeys.benefit(id),
    queryFn: () => api.get(`/benefits/${encodeURIComponent(id)}`, benefitCategoryDetailSchema),
  })

export const useChannels = () =>
  useQuery({
    queryKey: queryKeys.channels,
    queryFn: () => api.get('/channels', z.array(channelSchema)),
  })

export const usePosts = (channel?: string) =>
  useQuery({
    queryKey: queryKeys.posts(channel),
    queryFn: () => api.get(`/posts${toQuery({ channel })}`, z.array(postSchema)),
  })

export const usePost = (id: string) =>
  useQuery({
    queryKey: queryKeys.post(id),
    queryFn: () => api.get(`/posts/${encodeURIComponent(id)}`, postSchema),
  })

export const useEvents = (filter: EventsFilter) =>
  useQuery({
    queryKey: queryKeys.events(filter),
    queryFn: () => api.get(`/events${toQuery(filter)}`, z.array(eventSchema)),
    placeholderData: (previous) => previous,
  })

export const useNotifications = () =>
  useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => api.get('/notifications', z.array(notificationSchema)),
  })

export const useCalendar = (date: string) =>
  useQuery({
    queryKey: queryKeys.calendar(date),
    queryFn: () => api.get(`/calendar${toQuery({ date })}`, z.array(calendarItemSchema)),
  })

export const useSearch = (q: string) =>
  useQuery({
    queryKey: queryKeys.search(q),
    queryFn: () => api.get(`/search${toQuery({ q })}`, z.array(searchResultSchema)),
    enabled: q.trim().length > 0,
  })

/* ---------- Мутации ---------- */

export function useToggleSubscription() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, subscribed }: { id: string; subscribed: boolean }) =>
      api.post(`/channels/${encodeURIComponent(id)}/subscription`, channelSchema, { subscribed }),
    onSuccess: (channel: Channel) => {
      client.setQueryData<Channel[]>(queryKeys.channels, (list) =>
        list?.map((item) => (item.id === channel.id ? channel : item)),
      )
      void client.invalidateQueries({ queryKey: ['post'] })
    },
  })
}

export function useToggleLike() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      api.post(`/posts/${encodeURIComponent(id)}/like`, postSchema, { liked }),
    onSuccess: (post: Post) => {
      client.setQueryData(queryKeys.post(post.id), post)
      client.setQueriesData<Post[]>({ queryKey: ['posts'] }, (list) =>
        list?.map((item) => (item.id === post.id ? post : item)),
      )
    },
  })
}

export function useEventRegistration() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, register }: { id: string; register: boolean }) =>
      register
        ? api.post(`/events/${encodeURIComponent(id)}/registration`, eventSchema)
        : api.delete(`/events/${encodeURIComponent(id)}/registration`, eventSchema),
    onSuccess: (event: CompanyEvent) => {
      client.setQueriesData<CompanyEvent[]>({ queryKey: ['events'] }, (list) =>
        list?.map((item) => (item.id === event.id ? event : item)),
      )
    },
  })
}

export function useMarkNotificationsRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all', okSchema),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notifications }),
  })
}

export const useSendFeedback = () =>
  useMutation({
    mutationFn: (value: 'like' | 'dislike') => api.post('/feedback', okSchema, { value }),
  })
