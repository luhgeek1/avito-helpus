import { Link } from '@/shared/lib/portal-navigation'
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'
import { useState } from 'react'
import {
  useBanners,
  useBenefitCategories,
  useBirthdays,
  useMe,
  usePosts,
  usePromos,
  useQuickActions,
  useServices,
} from '@/shared/api'
import type { QuickAction } from '@/shared/api'
import { ChannelList } from '@/widgets/portal-feed'
import { PostCard, postGridClass } from '@/widgets/portal-feed'
import { Avatar, Button, buttonClass, cx, ErrorState, focusRing, heading, HrefLink, IconButton, Illustration, Modal, paletteClass, SectionHead, Skeleton } from '@/shared/ui/portal'
import { SERVICE_ILLUSTRATION } from '@/shared/ui/portal'
import { formatDayMonthShort } from '@/shared/lib/portal-format'
import { usePreferences } from '@/entities/portal'
import { portalGlobals } from '@/shared/ui/portal'
import s from './home.styles'

const panel = 'flex flex-col rounded-3xl bg-fill px-6 pt-5 pb-6 hub-max-720:p-4'
const panelHead = 'mb-4 flex items-center justify-between gap-3'
/** Quick actions fill one row up to three, then two even rows of at most four columns. */
const quickColumns = ['grid-cols-1', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4']

/** Баннеры листаются только по клику, как на avito.ru: без автопрокрутки, с плавной сменой. */
function HeroCarousel() {
  const { data, isPending, isError, refetch } = useBanners()
  const [index, setIndex] = useState(0)
  const count = data?.length ?? 0

  if (isPending) return <Skeleton height={240} radius={24} />
  if (isError) return <ErrorState onRetry={() => refetch()} />
  if (!count) return null

  const banner = data[index % count]
  const go = (delta: number) => setIndex((value) => (value + delta + count) % count)

  return (
    <section aria-roledescription="карусель" aria-label="Главное в компании">
      <div
        className={cx(
          'relative flex min-h-60 items-center justify-between gap-6 overflow-hidden rounded-3xl bg-tone px-10 py-9 text-tone-fg',
          'transition-colors duration-200 ease-out hub-max-720:min-h-55 hub-max-720:p-6',
          paletteClass[banner.palette],
        )}
        aria-live="polite"
      >
        <div key={banner.id} className="relative z-1 max-w-145 animate-hub-home-slideIn">
          <h2 className={cx(heading.h1, 'mb-2.5')}>{banner.title}</h2>
          <p className="mb-6 text-16 leading-6 opacity-92">{banner.text}</p>
          <HrefLink href={banner.href} className={buttonClass('white', 'l')}>
            {banner.cta}
          </HrefLink>
        </div>
        <Illustration key={`art-${banner.id}`} name={banner.illustration} size={230} className="mr-6 animate-hub-home-slideIn hub-max-720:hidden"
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1.5">
          {data.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={cx(
                'h-2 w-2 rounded-sm border-0 bg-fill-strong transition-[width,background-color] duration-200 ease-out',
                i === index % count && 'w-6 bg-dark',
              )}
              aria-label={`Слайд ${i + 1}: ${item.title}`}
              aria-current={i === index % count}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        <div className="flex gap-1">
          <IconButton label="Предыдущий слайд" onClick={() => go(-1)}>
            <ChevronLeft size={20} />
          </IconButton>
          <IconButton label="Следующий слайд" onClick={() => go(1)}>
            <ChevronRight size={20} />
          </IconButton>
        </div>
      </div>
    </section>
  )
}

function QuickActionsSettings({ all, onClose }: { all: QuickAction[]; onClose: () => void }) {
  const { quickActionIds, setQuickActions } = usePreferences()
  const [selected, setSelected] = useState(() => new Set(quickActionIds))

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = () => {
    setQuickActions(all.filter((item) => selected.has(item.id)).map((item) => item.id))
    onClose()
  }

  return (
    <Modal title="Настроить подборку" onClose={onClose}>
      <div className="mb-5 flex flex-col gap-0.5">
        {all.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-fill">
            <input
              type="checkbox"
              className={cx('size-5 accent-blue', focusRing)}
              checked={selected.has(item.id)}
              onChange={() => toggle(item.id)}
            />
            {item.title}
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button variant="accent" onClick={save} disabled={selected.size === 0}>
          Сохранить
        </Button>
      </div>
    </Modal>
  )
}

function QuickActions() {
  const { data, isPending, isError, refetch } = useQuickActions()
  const ids = usePreferences((state) => state.quickActionIds)
  const [editing, setEditing] = useState(false)
  const visible = data?.filter((item) => ids.includes(item.id)) ?? []
  // Ряды одинаковой длины: до трёх действий — в одну строку, дальше — поровну в две строки, не больше 4 колонок
  const columns = visible.length <= 3 ? Math.max(visible.length, 1) : Math.min(4, Math.ceil(visible.length / 2))

  return (
    <section className={panel} aria-label="Быстрые действия">
      <div className={panelHead}>
        <h3 className={heading.h3}>Когда нужно быстрое решение</h3>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 border-0 bg-transparent whitespace-pre text-link hover:text-link-hover"
          onClick={() => setEditing(true)}
          disabled={!data}
          aria-label="Настроить подборку"
        >
          <Settings2 size={16} aria-hidden />
          {/* One label span: the flex gap belongs only between the icon and the text. */}
          <span>
            Настроить<span className="hub-max-720:hidden"> подборку</span>
          </span>
        </button>
      </div>
      {isPending && <Skeleton height={88} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      <div
        className={cx(
          'grid flex-1 auto-rows-[minmax(40px,1fr)] gap-2 hub-max-720:grid-cols-2',
          quickColumns[columns],
        )}
      >
        {visible.map((item) => (
          <HrefLink key={item.id} href={item.href} title={item.title}
            className="flex min-w-0 items-center rounded-xl bg-white px-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-shadow duration-150 ease-out hover:shadow-float active:bg-white-pressed hub-max-720:min-h-12 hub-max-720:px-3 hub-max-720:py-1.5"
          >
            <span className="truncate hub-max-720:line-clamp-2 hub-max-720:leading-4.5 hub-max-720:whitespace-normal">{item.title}</span>
          </HrefLink>
        ))}
      </div>
      {editing && data && <QuickActionsSettings all={data} onClose={() => setEditing(false)} />}
    </section>
  )
}

function Birthdays() {
  const { data, isPending, isError, refetch } = useBirthdays()
  return (
    <section className={panel} aria-label="Дни рождения">
      <div className={panelHead}>
        <h3 className={heading.h3}>Дни рождения</h3>
      </div>
      {isPending && <Skeleton height={88} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      <div className="flex justify-between gap-2">
        {data?.map(({ person, date }) => (
          <div key={person.id} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <Avatar firstName={person.firstName} lastName={person.lastName} palette={person.palette} size={56} />
            <span>{person.firstName}</span>
            <span className="text-13 leading-4.5 text-secondary">{formatDayMonthShort(date)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

const DOCS = [
  { id: 'edo', title: 'ЭДО', illustration: 'document' as const },
  { id: 'vacation', title: 'Справки и отпуск', illustration: 'folders' as const },
  { id: 'trip', title: 'Командировки', illustration: 'suitcase' as const },
]

function Services() {
  const { data, isPending, isError, refetch } = useServices()
  const featured = data?.filter((item) => item.featured && item.id !== 'edo') ?? []

  return (
    <section aria-label="Сервисы">
      <SectionHead title="Сервисы" href="/services" linkText="Все сервисы" />
      {isPending && <Skeleton height={212} radius={24} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && (
        <div className={s.services}>
          <div className={s.tiles}>
            {featured.map((service) => (
              <Link
                key={service.id}
                to="/services/$serviceId"
                params={{ serviceId: service.id }}
                className={s.tile}
              >
                <span className={s.tileTitle}>{service.title}</span>
                <Illustration name={SERVICE_ILLUSTRATION[service.icon]} size={100} className={s.tileArt} />
              </Link>
            ))}
          </div>
          <div className={s.docs}>
            <h3>Документы</h3>
            <div className={s.docsItems}>
              {DOCS.map((doc) => (
                <Link key={doc.id} to="/services/$serviceId" params={{ serviceId: doc.id }} className={s.docsItem}>
                  <span className={s.docsIcon}>
                    <Illustration name={doc.illustration} size={58} />
                  </span>
                  {doc.title}
                </Link>
              ))}
            </div>
            <Link
              to="/services/$serviceId"
              params={{ serviceId: 'edo' }}
              className={cx(buttonClass('white', 'm'), s.docsButton)}
            >
              Все документы
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}

function Promos() {
  const { data } = usePromos()
  if (!data?.length) return null
  return (
    <section className={s.promos} aria-label="Анонсы">
      {data.map((promo) => (
        <HrefLink key={promo.id} href={promo.href} className={cx(s.promo, portalGlobals[`palette-${promo.palette}`])}>
          <h3>{promo.title}</h3>
          <p>{promo.text}</p>
          <Illustration name={promo.illustration} size={160} className={s.promoArt} />
        </HrefLink>
      ))}
    </section>
  )
}

function Plus() {
  const { data, isPending, isError, refetch } = useBenefitCategories()
  return (
    <section aria-label="Плюсы">
      <SectionHead title="Плюсы" href="/benefits/savings" linkText="Подробнее о Плюсах" />
      {isPending && <Skeleton height={336} radius={24} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      <div className={s.plusTiles}>
        {data?.map((category) => (
          <HrefLink key={category.id} href={category.href} className={cx(s.plusTile, portalGlobals[`palette-${category.palette}`])}>
            <h3>{category.title}</h3>
            <p>{category.description}</p>
            <Illustration name={category.illustration} size={160} className={s.plusArt} />
          </HrefLink>
        ))}
      </div>
    </section>
  )
}

function Feed() {
  const { data, isPending, isError, refetch } = usePosts()
  return (
    <section aria-label="Это что-то новенькое">
      <SectionHead title="Это что-то новенькое" href="/feed" linkText="Перейти в ленту" />
      <div className={s.feed}>
        <div>
          {isPending && <Skeleton height={360} />}
          {isError && <ErrorState onRetry={() => refetch()} />}
          <div className={postGridClass}>
            {data?.slice(0, 6).map((post) => <PostCard key={post.id} post={post} />)}
          </div>
        </div>
        <div className={s.sticky}>
          <ChannelList />
        </div>
      </div>
    </section>
  )
}

export function HomePage() {
  const { data: me } = useMe()

  return (
    <div className={`${portalGlobals.container} ${s.page}`}>
      <HeroCarousel />
      <section>
        <div className={s.greeting}>
          <h1>{me ? `Привет, ${me.firstName}! Хорошего дня в Авито` : 'Привет! Хорошего дня в Авито'}</h1>
          <p className={s.greetingSub}>Всё для работы, развития и заботы о себе — в одном месте</p>
        </div>
        <div className={s.row}>
          <QuickActions />
          <Birthdays />
        </div>
      </section>
      <Services />
      <Promos />
      <Plus />
      <Feed />
    </div>
  )
}
