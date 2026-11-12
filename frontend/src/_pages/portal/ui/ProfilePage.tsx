import { Link } from '@/shared/lib/portal-navigation'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Laptop,
  Mail,
  MessageCircle,
  Phone,
  Video,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ApiError } from '@/shared/api'
import { useCalendar, useMe, usePerson } from '@/shared/api'
import type { Person, PersonShort } from '@/shared/api'
import { Avatar, container, cx, EmptyState, ErrorState, heading, Illustration, paletteClass, Skeleton } from '@/shared/ui/portal'
import { formatDayMonth, formatTime, formatWeekday, toDateKey } from '@/shared/lib/portal-format'
import { NotFoundPage } from './NotFoundPage'

const box = 'rounded-3xl bg-fill p-5'
const link = 'text-link hover:text-link-hover'
const roundAction = 'transition-colors duration-150 ease-button hover:text-link-hover active:bg-white-pressed'
const contact = cx('inline-flex size-10 items-center justify-center rounded-full border-0 bg-white text-primary', roundAction)
const calendarMode = 'h-7 rounded-lg border-0 bg-transparent px-2.5 text-13 text-secondary'
const calendarModeActive = 'bg-white text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
const calendarArrow = 'inline-flex size-7 items-center justify-center rounded-full border-0 bg-white'
const section = 'not-first:mt-10'
const sectionHead = 'mb-3 flex items-center justify-between gap-3'
const tableRow = 'flex items-center justify-between gap-4 rounded-2xl bg-fill px-4 py-3.5'
const muted = 'text-13 text-secondary'

/* ---------- Левая колонка ---------- */

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <button
      type="button"
      className={cx('inline-flex h-7 items-center gap-1 rounded-lg border-0 bg-white px-2.5 text-13', roundAction)}
      onClick={copy}
      aria-label={`Скопировать ${label}`}>
      <Copy size={13} />
      {copied ? 'Скопировано' : value}
    </button>
  )
}

function IdentityCard({ person, isMe }: { person: Person; isMe: boolean }) {
  return (
    <div className={cx(box, 'flex flex-col items-center gap-1 text-center')}>
      <Avatar firstName={person.firstName} lastName={person.lastName} palette={person.palette} size={96} />
      <div className="mt-3 text-21 leading-6.5 font-bold">
        {person.lastName} {person.firstName}
        {person.middleName ? ` ${person.middleName}` : ''}
      </div>
      <div className="text-secondary">
        {person.position} ·{' '}
        <Link to="/feed" search={{ channel: 'platform' }} className={link}>
          {person.team}
        </Link>
      </div>
      <div className="mt-2 flex justify-center gap-2">
        <CopyButton value={person.login} label="логин" />
        <CopyButton value={person.employeeId} label="табельный номер" />
      </div>
      <div className="mt-3 flex gap-2">
        <a className={contact} href={`mailto:${person.email}`} aria-label="Написать письмо">
          <Mail size={16} />
        </a>
        <button type="button" className={contact} aria-label="Написать в мессенджер">
          <MessageCircle size={16} />
        </button>
        <button type="button" className={contact} aria-label="Позвонить">
          <Phone size={16} />
        </button>
        <button type="button" className={contact} aria-label="Созвониться по видео">
          <Video size={16} />
        </button>
      </div>
      {isMe && (
        <div className="mt-4 flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 font-bold">
          <span>В офис</span>
          <Link to="/services/$serviceId" params={{ serviceId: 'booking' }} className={cx(link, 'font-normal')}>
            Забронировать место
          </Link>
        </div>
      )}
    </div>
  )
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeek(date: Date) {
  const day = (date.getDay() + 6) % 7
  return addDays(date, -day)
}

export function CalendarWidget() {
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [date, setDate] = useState(() => new Date())
  const key = toDateKey(date)
  const { data, isPending, isError, refetch } = useCalendar(key)
  const step = mode === 'day' ? 1 : 7
  const weekStart = startOfWeek(date)

  return (
    <section className={box} aria-label="Календарь">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex rounded-[10px] bg-control p-0.5" role="group" aria-label="Режим календаря">
          <button
            type="button"
            className={cx(calendarMode, mode === 'week' && calendarModeActive)}
            aria-pressed={mode === 'week'}
            onClick={() => setMode('week')}
          >
            Неделя
          </button>
          <button
            type="button"
            className={cx(calendarMode, mode === 'day' && calendarModeActive)}
            aria-pressed={mode === 'day'}
            onClick={() => setMode('day')}
          >
            День
          </button>
        </div>
        <div className="flex gap-1">
          <button type="button" className={calendarArrow} aria-label="Назад" onClick={() => setDate((d) => addDays(d, -step))}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className={calendarArrow} aria-label="Вперёд" onClick={() => setDate((d) => addDays(d, step))}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="rounded-2xl bg-white p-3">
        {mode === 'week' && (
          <div className="mb-2 grid grid-cols-7 gap-0.5 text-center text-12">
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => (
              <button
                key={day.toISOString()}
                type="button"
                className={cx(
                  'flex flex-col gap-0.5 rounded-[10px] border-0 bg-transparent py-1.5 text-secondary transition-colors duration-150 ease-out hover:bg-control-hover hover:duration-200',
                  toDateKey(day) === key && 'bg-dark text-white hover:bg-dark hover:text-white',
                )}
                onClick={() => setDate(day)}
                aria-label={formatDayMonth(day.toISOString())}
              >
                <span>{formatWeekday(day)}</span>
                <span className={cx('text-15 font-bold', toDateKey(day) !== key && 'text-primary')}>{day.getDate()}</span>
              </button>
            ))}
          </div>
        )}
        <div className="mb-2 text-center text-13 font-bold">
          {formatDayMonth(date.toISOString())}, {formatWeekday(date)}
        </div>
        {isPending && <Skeleton height={120} />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data?.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-2 border-t border-divider py-1.5 text-13 leading-4"
          >
            <span className="text-secondary">{formatTime(item.start)}</span>
            <span
              className={cx('truncate rounded-lg border-l-3 border-tone bg-tone-soft px-2 py-1.5', paletteClass[item.palette])}
            >
              {item.title}
            </span>
          </div>
        ))}
      </div>
      <Link to="/services/$serviceId" params={{ serviceId: 'booking' }}
        className={cx(link, 'mt-3 flex items-center justify-center gap-1.5')}
      >
        <CalendarDays size={14} />
        Перейти в календарь
      </Link>
    </section>
  )
}

/* ---------- Вкладки ---------- */

const TABS = [
  { id: 'work', title: 'Работа', private: false },
  { id: 'personal', title: 'Личные данные', private: true },
  { id: 'documents', title: 'Документы', private: true },
  { id: 'review', title: 'Ревью', private: true },
  { id: 'posts', title: 'Посты', private: false },
  { id: 'learning', title: 'Обучение', private: true },
] as const

type TabId = (typeof TABS)[number]['id']

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-14 grid-cols-[240px_minmax(0,1fr)] items-center gap-4 border-b border-divider py-2 hub-max-720:grid-cols-1 hub-max-720:gap-1">
      <span className="text-secondary">{label}</span>
      <span>{children}</span>
    </div>
  )
}

function PersonLink({ person }: { person: PersonShort | null }) {
  if (!person) return <>—</>
  return (
    <Link to="/people/$personId" params={{ personId: person.id }} className="inline-flex items-center gap-3 hover:text-link-hover">
      <Avatar firstName={person.firstName} lastName={person.lastName} palette={person.palette} size={40} />
      <span>
        {person.lastName} {person.firstName}
        <span className="block text-13 leading-4.5 text-secondary">{person.position}</span>
      </span>
    </Link>
  )
}

function WorkTab({ person, isMe }: { person: Person; isMe: boolean }) {
  return (
    <>
      <section className={section}>
        <div className={sectionHead}>
          <h2 className={heading.h2}>{isMe ? 'Обо мне' : 'О сотруднике'}</h2>
        </div>
        <div className="flex flex-col">
          <Field label="Специализация">{person.specialization}</Field>
          <Field label="Грейд">{person.grade}</Field>
          <Field label="Продукты">
            {person.products.length ? person.products.join(', ') : '—'}
          </Field>
          {person.manager && (
            <Field label="Руководитель">
              <PersonLink person={person.manager} />
            </Field>
          )}
          {person.mentor && (
            <Field label="Наставник">
              <PersonLink person={person.mentor} />
            </Field>
          )}
          {person.hrbp && (
            <Field label="HR BP">
              <PersonLink person={person.hrbp} />
            </Field>
          )}
          <Field label="Офис и режим работы">
            {person.office} · {person.workMode}
          </Field>
          <Field label="В Авито">{person.tenure}</Field>
          <Field label="Организация и должность">{person.organization}</Field>
        </div>
      </section>

      <section className={section}>
        <div className={sectionHead}>
          <h2 className={heading.h2}>
            {isMe ? 'Мои достижения' : 'Достижения'} {person.achievements.length}
          </h2>
        </div>
        {person.achievements.length === 0 ? (
          <EmptyState>Достижений пока нет</EmptyState>
        ) : (
          <div className="flex flex-wrap gap-4">
            {person.achievements.map((achievement) => (
              <div key={achievement.id} className="flex w-33 flex-col items-center gap-1.5 text-center">
                <span
                  className={cx(
                    'inline-flex size-24 items-center justify-center rounded-3xl bg-tone-soft',
                    paletteClass[achievement.palette],
                  )}
                >
                  <Illustration name={achievement.palette === 'green' ? 'trophy' : 'medal'} size={64} />
                </span>
                <span>{achievement.title}</span>
                <span className="text-13 leading-4.5 text-secondary">{achievement.description}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {isMe && (
        <section className={section}>
          <div className={sectionHead}>
            <h2 className={heading.h2}>Моё оборудование</h2>
            <Link to="/services/$serviceId" params={{ serviceId: 'it' }} className={link}>
              Заказать
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {person.equipment.map((item) => (
              <div key={item.id} className={tableRow}>
                <span className="inline-flex items-center gap-2.5">
                  <Laptop size={18} aria-hidden />
                  {item.title}
                </span>
                <span className={muted}>{item.inventoryNumber}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function TabContent({ tab, person, isMe }: { tab: TabId; person: Person; isMe: boolean }) {
  switch (tab) {
    case 'work':
      return <WorkTab person={person} isMe={isMe} />
    case 'personal':
      return (
        <section className={section}>
          <div className={sectionHead}>
            <h2 className={heading.h2}>Личные данные</h2>
          </div>
          <div className="flex flex-col">
            <Field label="Рабочая почта">{person.email}</Field>
            <Field label="День рождения">{person.birthday}</Field>
            <Field label="Город">{person.city}</Field>
          </div>
        </section>
      )
    case 'documents':
      return (
        <section className={section}>
          <div className={sectionHead}>
            <h2 className={heading.h2}>Документы</h2>
          </div>
          <div className="flex flex-col gap-2">
            {person.documents.map((doc) => (
              <div key={doc.id} className={tableRow}>
                <span>
                  {doc.title}
                  <span className={muted}> · {formatDayMonth(doc.date)}</span>
                </span>
                <span
                  className={cx(
                    'shrink-0 rounded-lg px-2.5 py-1 text-13',
                    doc.status === 'signed' ? 'bg-green-soft text-green-text' : 'bg-red-soft text-red-text',
                  )}
                >
                  {doc.status === 'signed' ? 'Подписан' : 'Ждёт подписи'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )
    case 'review':
      return <EmptyState>Первое ревью компетенций пройдёт в середине стажировки</EmptyState>
    case 'posts':
      return <EmptyState>{isMe ? 'Вы пока ничего не публиковали' : 'Постов пока нет'}</EmptyState>
    case 'learning':
      return (
        <section className={section}>
          <div className={sectionHead}>
            <h2 className={heading.h2}>Обучение</h2>
            <Link to="/services/$serviceId" params={{ serviceId: 'learning' }} className={link}>
              Все курсы
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {person.courses.map((course) => (
              <div key={course.id} className={tableRow}>
                <span>
                  {course.title}
                  <span className={muted}>
                    {course.progress === 100
                      ? ' · пройден'
                      : course.deadline
                        ? ` · до ${formatDayMonth(course.deadline)}`
                        : ''}
                  </span>
                </span>
                <span
                  className="h-1.5 w-40 shrink-0 overflow-hidden rounded-[3px] bg-fill-strong hub-max-720:w-20"
                  role="progressbar"
                  aria-valuenow={course.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Прогресс: ${course.progress}%`}
                >
                  <span className="h-full rounded-[3px] bg-green" style={{ width: `${course.progress}%` }} />
                </span>
              </div>
            ))}
          </div>
        </section>
      )
  }
}

/* ---------- Страница ---------- */

export function ProfilePage({ personId }: { personId: string }) {
  const meQuery = useMe()
  const isMe = personId === 'me' || personId === meQuery.data?.id
  const personQuery = usePerson(personId, personId !== 'me')
  const query = personId === 'me' ? meQuery : personQuery
  const [tab, setTab] = useState<TabId>('work')

  if (query.isError && query.error instanceof ApiError && query.error.status === 404) return <NotFoundPage />

  const person = query.data
  const tabs = TABS.filter((item) => isMe || !item.private)
  const activeTab = tabs.some((item) => item.id === tab) ? tab : 'work'

  return (
    <div className={container}>
      {query.isPending && <Skeleton height={480} />}
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {person && (
        <div className="grid grid-cols-[320px_minmax(0,1fr)] items-start gap-10 hub-max-900:grid-cols-1">
          <div className="flex flex-col gap-4">
            <IdentityCard person={person} isMe={isMe} />
            {isMe && <CalendarWidget />}
            <div className={box}>
              <div className="flex items-center justify-between">
                <h3 className={heading.h3}>{isMe ? 'Мои посты' : 'Посты'}</h3>
                <Link to="/feed" className={link}>
                  Подробнее
                </Link>
              </div>
              <div className="mt-2 flex gap-4 text-secondary">
                <span>
                  <b className="text-primary">{person.followers}</b> подписчиков
                </span>
                <span>
                  <b className="text-primary">{person.following}</b> подписок
                </span>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Разделы профиля">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === item.id}
                  className={cx(
                    'h-10 rounded-xl border-0 bg-control px-4 transition-colors duration-150 ease-out hover:bg-control-hover hover:duration-200 active:bg-control-pressed',
                    activeTab === item.id && 'bg-dark text-white hover:bg-dark active:bg-dark',
                  )}
                  onClick={() => setTab(item.id)}
                >
                  {item.title}
                </button>
              ))}
            </div>
            <div role="tabpanel">
              <TabContent tab={activeTab} person={person} isMe={isMe} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
