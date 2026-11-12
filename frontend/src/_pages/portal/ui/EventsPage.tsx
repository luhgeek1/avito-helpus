import { portalGlobals } from '@/shared/ui/portal'
import { getRouteApi } from '@/shared/lib/portal-navigation'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useEventRegistration, useEvents, type EventsFilter } from '@/shared/api'
import type { CompanyEvent, EventCategory } from '@/shared/api'
import { Button, Cover, cx, Emoji, EmptyState, ErrorState, Skeleton } from '@/shared/ui/portal'
import { formatDateTime, formatTime } from '@/shared/lib/portal-format'
import s from './events.styles'
import p from './pages.styles'

const route = getRouteApi('/events')

const CATEGORIES: { id: EventCategory; title: string; emoji: string }[] = [
  { id: 'development', title: 'Развитие', emoji: '🎓' },
  { id: 'health', title: 'Здоровье', emoji: '🧘' },
  { id: 'sport', title: 'Спорт', emoji: '⚽️' },
  { id: 'office', title: 'Офис', emoji: '🏢' },
  { id: 'culture', title: 'Афиша', emoji: '🎭' },
]

const categoryTitle = (id: EventCategory) => CATEGORIES.find((item) => item.id === id)?.title ?? id
const formatTitle = (event: CompanyEvent) => (event.format === 'online' ? 'Онлайн' : 'Офлайн')

function RegisterButton({ event, size = 'm' }: { event: CompanyEvent; size?: 'm' | 'l' }) {
  const registration = useEventRegistration()
  const full = event.seatsLeft === 0 && !event.registered
  return (
    <Button
      variant={event.registered ? 'secondary' : 'success'}
      size={size}
      disabled={registration.isPending || full}
      onClick={() => registration.mutate({ id: event.id, register: !event.registered })}
      aria-label={`${event.registered ? 'Отменить запись' : 'Записаться'}: ${event.title}`}
    >
      {full ? 'Мест нет' : event.registered ? 'Вы записаны ✓' : 'Записаться'}
    </Button>
  )
}

function FeaturedEvents() {
  const { data, isPending } = useEvents({})
  const featured = data?.filter((event) => event.featured) ?? []
  if (isPending) return <Skeleton height={300} />
  if (!featured.length) return null
  return (
    <section aria-label="Интересное">
      <h2 className={p.sectionTitle}>Интересное</h2>
      <div className={s.featured}>
        {featured.map((event) => (
          <article key={event.id} className={s.eventCard}>
            <Cover illustration={event.illustration} palette={event.palette} badge={formatTitle(event)} />
            <div className={s.eventDate}>{formatDateTime(event.startsAt)}</div>
            <div>{event.title}</div>
            <div className={s.eventMeta}>{event.place}</div>
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
    <article className={s.row}>
      <div className={cx(s.rowDate, portalGlobals[`palette-${event.palette}`])} aria-hidden>
        <span className={s.rowDay}>{date.getDate()}</span>
        <span className={s.rowMonth}>{month}</span>
      </div>
      <div>
        <h3 className={s.rowTitle}>{event.title}</h3>
        <p className={s.rowText}>{event.description}</p>
        <div className={s.rowMeta}>
          <span>{formatTime(event.startsAt)}</span>
          <span>{event.place}</span>
          <span className={s.tag}>{categoryTitle(event.category)}</span>
          <span className={s.tag}>{formatTitle(event)}</span>
          {event.seatsLeft !== null && <span>Осталось мест: {event.seatsLeft}</span>}
          {event.registered && <span className={cx(s.tag, s.registered)}>Вы идёте</span>}
        </div>
      </div>
      <RegisterButton event={event} />
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
    <div className={`${portalGlobals.container} ${p.page}`}>
      <div className={s.head}>
        <h1>События</h1>
        <select className={s.city} value={city} onChange={(event) => setCity(event.target.value)} aria-label="Город">
          <option>Москва</option>
          <option>Санкт-Петербург</option>
          <option>Онлайн</option>
        </select>
      </div>

      <section className={s.banner}>
        <div>
          <h2>Все события — в одном месте</h2>
          <p>Рассказываем обо всём, что происходит у нас в компании</p>
        </div>
        <Emoji size={150} className={s.bannerArt}>
          🎉
        </Emoji>
      </section>

      <div className={s.categories} role="group" aria-label="Категории">
        {CATEGORIES.map((category) => {
          const active = search.category === category.id
          return (
            <button
              key={category.id}
              type="button"
              className={cx(s.category, active && s.categoryActive)}
              aria-pressed={active}
              onClick={() => setFilter({ category: active ? undefined : category.id })}
            >
              <span className={s.categoryTitle}>{category.title}</span>
              <Emoji size={44} className={s.categoryArt}>
                {category.emoji}
              </Emoji>
            </button>
          )
        })}
      </div>

      <div className={s.toolbar}>
        <label className={s.searchWrap}>
          <span className={portalGlobals["visually-hidden"]}>Найти событие</span>
          <Search className={s.searchIcon} size={18} aria-hidden />
          <input
            className={s.search}
            type="search"
            placeholder="Найти событие"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </label>
        <select
          className={s.select}
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
          className={s.select}
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
        <h2 className={p.sectionTitle}>Ближайшие события</h2>
        {isPending && <Skeleton height={300} />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data && data.length === 0 && <EmptyState>Ничего не нашли — попробуйте изменить фильтры</EmptyState>}
        <div className={s.upcoming}>
          {data?.map((event) => <UpcomingRow key={event.id} event={event} />)}
        </div>
      </section>
    </div>
  )
}
