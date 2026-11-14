import { getRouteApi } from '@/shared/lib/portal-navigation'
import { Check, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useEventRegistration, useEvents, type EventsFilter } from '@/shared/api'
import type { CompanyEvent, EventCategory, Illustration as IllustrationName } from '@/shared/api'
import { Button, container, Cover, cx, EmptyState, ErrorState, focusRing, heading, Illustration, paletteClass, Skeleton } from '@/shared/ui/portal'
import { formatDateTime, formatTime } from '@/shared/lib/portal-format'
import { page } from './classes'

const route = getRouteApi('/events')

const CATEGORIES: { id: EventCategory; title: string; illustration: IllustrationName }[] = [
  { id: 'development', title: 'Развитие', illustration: 'grad-cap' },
  { id: 'health', title: 'Здоровье', illustration: 'yoga-mat' },
  { id: 'sport', title: 'Спорт', illustration: 'football' },
  { id: 'office', title: 'Офис', illustration: 'office-building' },
  { id: 'culture', title: 'Афиша', illustration: 'tickets' },
]

const sectionTitle = cx(heading.h2, 'mb-4')
const tag = 'inline-block rounded-md bg-control px-2 py-0.5 text-primary'
const select = cx('h-11 rounded-xl border-0 bg-control px-3', focusRing)

const categoryTitle = (id: EventCategory) => CATEGORIES.find((item) => item.id === id)?.title ?? id
const formatTitle = (event: CompanyEvent) => (event.format === 'online' ? 'Онлайн' : 'Офлайн')

function RegisterButton({ event, size = 'm', className }: { event: CompanyEvent; size?: 'm' | 'l'; className?: string }) {
  const registration = useEventRegistration()
  const full = event.seatsLeft === 0 && !event.registered
  return (
    <Button
      variant={event.registered ? 'secondary' : 'success'}
      size={size}
      className={className}
      disabled={registration.isPending || full}
      onClick={() => registration.mutate({ id: event.id, register: !event.registered })}
      aria-label={`${event.registered ? 'Отменить запись' : 'Записаться'}: ${event.title}`}
    >
      {full ? 'Мест нет' : event.registered ? 'Вы записаны' : 'Записаться'}
      {event.registered && !full && <Check size={16} aria-hidden />}
    </Button>
  )
}

function FeaturedEvents() {
  const { data, isPending } = useEvents({})
  const featured = data?.filter((event) => event.featured) ?? []
  if (isPending) return <Skeleton className="h-75" />
  if (!featured.length) return null
  return (
    <section aria-label="Интересное">
      <h2 className={sectionTitle}>Интересное</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-6 hub-max-720:grid-cols-2 hub-max-720:gap-x-3">
        {featured.map((event) => (
          <article key={event.id} className="flex flex-col gap-1.5">
            <Cover illustration={event.illustration} palette={event.palette} badge={formatTitle(event)} />
            <div className="mt-1 text-16 leading-5 font-bold">{formatDateTime(event.startsAt)}</div>
            <div>{event.title}</div>
            <div className="mb-1.5 text-13 leading-4.5 text-secondary">{event.place}</div>
            <div>
              <RegisterButton event={event} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function UpcomingRow({ event }: { event: CompanyEvent }) {
  const date = new Date(event.startsAt)
  const month = date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')
  return (
    <article className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-5 border-b border-divider py-4 hub-max-720:grid-cols-[64px_minmax(0,1fr)]">
      <div
        className={cx('flex h-18 flex-col items-center justify-center rounded-2xl bg-tone-soft', paletteClass[event.palette])}
        aria-hidden
      >
        <span className="text-24 leading-7.5 font-bold">{date.getDate()}</span>
        <span className="text-13 leading-4 text-secondary">{month}</span>
      </div>
      <div>
        <h3 className="text-16 leading-5.5 font-bold">{event.title}</h3>
        <p className="mt-0.5 text-secondary">{event.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-13 leading-4.5 text-secondary">
          <span>{formatTime(event.startsAt)}</span>
          <span>{event.place}</span>
          <span className={tag}>{categoryTitle(event.category)}</span>
          <span className={tag}>{formatTitle(event)}</span>
          {event.seatsLeft !== null && <span>Осталось мест: {event.seatsLeft}</span>}
          {event.registered && <span className={cx(tag, 'bg-green-soft text-green-text')}>Вы идёте</span>}
        </div>
      </div>
      <RegisterButton event={event} className="hub-max-720:col-span-full" />
    </article>
  )
}

export function EventsPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [q, setQ] = useState(search.q ?? '')
  const [city, setCity] = useState('Москва')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if ((search.q ?? '') !== q) {
        void navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true })
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [q, search.q, navigate])

  const { data, isPending, isError, refetch, isFetching } = useEvents(search)

  const setFilter = (patch: Partial<EventsFilter>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })

  return (
    <div className={cx(container, page)}>
      <div className="flex items-center justify-between gap-4">
        <h1 className={heading.h1}>События</h1>
        <select className={select} value={city} onChange={(event) => setCity(event.target.value)} aria-label="Город">
          <option>Москва</option>
          <option>Санкт-Петербург</option>
          <option>Онлайн</option>
        </select>
      </div>

      <section className="relative flex min-h-55 items-center justify-between gap-6 overflow-hidden rounded-3xl bg-purple px-10 py-9 text-white hub-max-720:p-6">
        <div>
          <h2 className={cx(heading.h1, 'max-w-115')}>Все события — в одном месте</h2>
          <p className="mt-2.5 max-w-95 text-16 leading-6 opacity-92">Рассказываем обо всём, что происходит у нас в компании</p>
        </div>
        <Illustration name="party-popper" size={210} className="mr-8 hub-max-720:hidden" />
      </section>

      <div className="grid grid-cols-5 gap-2 hub-max-900:grid-cols-3 hub-max-720:grid-cols-2" role="group" aria-label="Категории">
        {CATEGORIES.map((category) => {
          const active = search.category === category.id
          return (
            <button
              key={category.id}
              type="button"
              className={cx(
                'relative h-22 overflow-hidden rounded-3xl border-2 border-transparent bg-fill px-5 py-3.5 text-left hover:bg-fill-hover',
                active && 'border-dark',
              )}
              aria-pressed={active}
              onClick={() => setFilter({ category: active ? undefined : category.id })}
            >
              <span className="relative z-1 block max-w-[max(calc(60%+4px),calc(100%-70px))]">{category.title}</span>
              <Illustration name={category.illustration} size={92} className="absolute -right-2.5 -bottom-4.5 h-auto w-[min(40%,92px)]"
              />
            </button>
          )
        })}
      </div>

      <div className="flex gap-2 hub-max-720:flex-wrap">
        <label className="relative flex-1 hub-max-720:basis-full">
          <span className="sr-only">Найти событие</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-secondary"
            size={18}
            aria-hidden
          />
          <input
            className="h-11 w-full rounded-xl border-2 border-transparent bg-control pr-4 pl-10.5 outline-none transition-colors duration-150 ease-out placeholder:text-secondary hover:bg-control-hover hover:duration-200 focus:border-focus focus:bg-white"
            type="search"
            placeholder="Найти событие"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </label>
        <select
          className={cx(select, 'hub-max-720:flex-1')}
          aria-label="Дата"
          value={search.period ?? ''}
          onChange={(event) => setFilter({ period: (event.target.value || undefined) as EventsFilter['period'] })}
        >
          <option value="">Любая дата</option>
          <option value="today">Сегодня</option>
          <option value="week">Эта неделя</option>
          <option value="month">Этот месяц</option>
        </select>
        <select
          className={cx(select, 'hub-max-720:flex-1')}
          aria-label="Формат"
          value={search.format ?? ''}
          onChange={(event) => setFilter({ format: (event.target.value || undefined) as EventsFilter['format'] })}
        >
          <option value="">Любой формат</option>
          <option value="online">Онлайн</option>
          <option value="offline">Офлайн</option>
        </select>
      </div>

      <FeaturedEvents />

      <section aria-label="Ближайшие события" aria-busy={isFetching}>
        <h2 className={sectionTitle}>Ближайшие события</h2>
        {isPending && <Skeleton className="h-75" />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data && data.length === 0 && <EmptyState>Ничего не нашли — попробуйте изменить фильтры</EmptyState>}
        <div className="flex flex-col">
          {data?.map((event) => <UpcomingRow key={event.id} event={event} />)}
        </div>
      </section>
    </div>
  )
}
