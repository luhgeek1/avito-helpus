import { portalGlobals } from '@/shared/ui/portal'
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
import { Avatar, cx, Emoji, EmptyState, ErrorState, Skeleton } from '@/shared/ui/portal'
import { formatDayMonth, formatTime, formatWeekday, toDateKey } from '@/shared/lib/portal-format'
import { NotFoundPage } from './NotFoundPage'
import s from './profile.styles'

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
    <button type="button" className={s.copy} onClick={copy} aria-label={`Скопировать ${label}`}>
      <Copy size={13} />
      {copied ? 'Скопировано' : value}
    </button>
  )
}

function IdentityCard({ person, isMe }: { person: Person; isMe: boolean }) {
  return (
    <div className={cx(s.box, s.identity)}>
      <Avatar firstName={person.firstName} lastName={person.lastName} palette={person.palette} size={96} />
      <div className={s.name}>
        {person.lastName} {person.firstName}
        {person.middleName ? ` ${person.middleName}` : ''}
      </div>
      <div className={s.position}>
        {person.position} · <Link to="/feed" search={{ channel: 'platform' }}>{person.team}</Link>
      </div>
      <div className={s.ids}>
        <CopyButton value={person.login} label="логин" />
        <CopyButton value={person.employeeId} label="табельный номер" />
      </div>
      <div className={s.contacts}>
        <a className={s.contact} href={`mailto:${person.email}`} aria-label="Написать письмо">
          <Mail size={16} />
        </a>
        <button type="button" className={s.contact} aria-label="Написать в мессенджер">
          <MessageCircle size={16} />
        </button>
        <button type="button" className={s.contact} aria-label="Позвонить">
          <Phone size={16} />
        </button>
        <button type="button" className={s.contact} aria-label="Созвониться по видео">
          <Video size={16} />
        </button>
      </div>
      {isMe && (
        <div className={s.office}>
          <span>В офис</span>
          <Link to="/services/$serviceId" params={{ serviceId: 'booking' }}>
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
    <section className={s.box} aria-label="Календарь">
      <div className={s.calendarHead}>
        <div className={s.modes} role="group" aria-label="Режим календаря">
          <button type="button" className={cx(s.mode, mode === 'week' && s.modeActive)} aria-pressed={mode === 'week'} onClick={() => setMode('week')}>
            Неделя
          </button>
          <button type="button" className={cx(s.mode, mode === 'day' && s.modeActive)} aria-pressed={mode === 'day'} onClick={() => setMode('day')}>
            День
          </button>
        </div>
        <div className={s.calendarNav}>
          <button type="button" className={s.navButton} aria-label="Назад" onClick={() => setDate((d) => addDays(d, -step))}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className={s.navButton} aria-label="Вперёд" onClick={() => setDate((d) => addDays(d, step))}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className={s.calendarBody}>
        {mode === 'week' && (
          <div className={s.week}>
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => (
              <button
                key={day.toISOString()}
                type="button"
                className={cx(s.weekDay, toDateKey(day) === key && s.weekDayActive)}
                onClick={() => setDate(day)}
                aria-label={formatDayMonth(day.toISOString())}
              >
                <span>{formatWeekday(day)}</span>
                <span className={s.weekNumber}>{day.getDate()}</span>
              </button>
            ))}
          </div>
        )}
        <div className={s.calendarDate}>
          {formatDayMonth(date.toISOString())}, {formatWeekday(date)}
        </div>
        {isPending && <Skeleton height={120} />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data?.map((item) => (
          <div key={item.id} className={s.slot}>
            <span className={s.slotTime}>{formatTime(item.start)}</span>
            <span className={cx(s.slotEvent, portalGlobals[`palette-${item.palette}`])}>{item.title}</span>
          </div>
        ))}
      </div>
      <Link to="/services/$serviceId" params={{ serviceId: 'booking' }} className={s.calendarLink}>
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
    <div className={s.field}>
      <span className={s.fieldLabel}>{label}</span>
      <span className={s.fieldValue}>{children}</span>
    </div>
  )
}

function PersonLink({ person }: { person: PersonShort | null }) {
  if (!person) return <>—</>
  return (
    <Link to="/people/$personId" params={{ personId: person.id }} className={s.personLink}>
      <Avatar firstName={person.firstName} lastName={person.lastName} palette={person.palette} size={40} />
      <span>
        {person.lastName} {person.firstName}
        <span className={s.personRole}>{person.position}</span>
      </span>
    </Link>
  )
}

function WorkTab({ person, isMe }: { person: Person; isMe: boolean }) {
  return (
    <>
      <section className={s.section}>
        <div className={s.sectionHead}>
          <h2>{isMe ? 'Обо мне' : 'О сотруднике'}</h2>
        </div>
        <div className={s.fields}>
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

      <section className={s.section}>
        <div className={s.sectionHead}>
          <h2>
            {isMe ? 'Мои достижения' : 'Достижения'} {person.achievements.length}
          </h2>
        </div>
        {person.achievements.length === 0 ? (
          <EmptyState>Достижений пока нет</EmptyState>
        ) : (
          <div className={s.achievements}>
            {person.achievements.map((achievement) => (
              <div key={achievement.id} className={s.achievement}>
                <span className={cx(s.medal, portalGlobals[`palette-${achievement.palette}`])}>
                  <Emoji size={48}>{achievement.palette === 'green' ? '🏆' : '🏅'}</Emoji>
                </span>
                <span>{achievement.title}</span>
                <span className={s.achievementText}>{achievement.description}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {isMe && (
        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2>Моё оборудование</h2>
            <Link to="/services/$serviceId" params={{ serviceId: 'it' }} className={s.link}>
              Заказать
            </Link>
          </div>
          <div className={s.table}>
            {person.equipment.map((item) => (
              <div key={item.id} className={s.tableRow}>
                <span className={s.rowTitle}>
                  <Laptop size={18} aria-hidden />
                  {item.title}
                </span>
                <span className={s.muted}>{item.inventoryNumber}</span>
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
        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2>Личные данные</h2>
          </div>
          <div className={s.fields}>
            <Field label="Рабочая почта">{person.email}</Field>
            <Field label="День рождения">{person.birthday}</Field>
            <Field label="Город">{person.city}</Field>
          </div>
        </section>
      )
    case 'documents':
      return (
        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2>Документы</h2>
          </div>
          <div className={s.table}>
            {person.documents.map((doc) => (
              <div key={doc.id} className={s.tableRow}>
                <span>
                  {doc.title}
                  <span className={s.muted}> · {formatDayMonth(doc.date)}</span>
                </span>
                <span className={cx(s.status, doc.status === 'signed' ? s.signed : s.pending)}>
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
        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2>Обучение</h2>
            <Link to="/services/$serviceId" params={{ serviceId: 'learning' }} className={s.link}>
              Все курсы
            </Link>
          </div>
          <div className={s.table}>
            {person.courses.map((course) => (
              <div key={course.id} className={s.tableRow}>
                <span>
                  {course.title}
                  <span className={s.muted}>
                    {course.progress === 100
                      ? ' · пройден'
                      : course.deadline
                        ? ` · до ${formatDayMonth(course.deadline)}`
                        : ''}
                  </span>
                </span>
                <span
                  className={s.progress}
                  role="progressbar"
                  aria-valuenow={course.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Прогресс: ${course.progress}%`}
                >
                  <span className={s.progressBar} style={{ width: `${course.progress}%` }} />
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
    <div className={portalGlobals.container}>
      {query.isPending && <Skeleton height={480} />}
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {person && (
        <div className={s.layout}>
          <div className={s.aside}>
            <IdentityCard person={person} isMe={isMe} />
            {isMe && <CalendarWidget />}
            <div className={s.box}>
              <div className={s.stats}>
                <h3>{isMe ? 'Мои посты' : 'Посты'}</h3>
                <Link to="/feed" className={s.link}>
                  Подробнее
                </Link>
              </div>
              <div className={s.statsRow}>
                <span>
                  <b>{person.followers}</b> подписчиков
                </span>
                <span>
                  <b>{person.following}</b> подписок
                </span>
              </div>
            </div>
          </div>
          <div>
            <div className={s.tabs} role="tablist" aria-label="Разделы профиля">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === item.id}
                  className={cx(s.tab, activeTab === item.id && s.tabActive)}
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
