import { portalGlobals } from '@/shared/ui/portal'
import { Link } from '@/shared/lib/portal-navigation'
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
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
import {
  Avatar,
  Button,
  buttonClass,
  cx,
  Emoji,
  ErrorState,
  HrefLink,
  IconButton,
  Modal,
  SectionHead,
  Skeleton,
} from '@/shared/ui/portal'
import { SERVICE_EMOJI } from '@/shared/ui/portal'
import { formatDayMonthShort } from '@/shared/lib/portal-format'
import { usePreferences } from '@/entities/portal'
import s from './home.styles'

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
      <div className={cx(s.slide, portalGlobals[`palette-${banner.palette}`])} aria-live="polite">
        <div key={banner.id} className={s.slideText}>
          <h2 className={s.slideTitle}>{banner.title}</h2>
          <p className={s.slideBody}>{banner.text}</p>
          <HrefLink href={banner.href} className={buttonClass('white', 'l')}>
            {banner.cta}
          </HrefLink>
        </div>
        <Emoji key={`art-${banner.id}`} size={150} className={s.slideArt}>
          {banner.emoji}
        </Emoji>
      </div>
      <div className={s.heroControls}>
        <div className={s.dots}>
          {data.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={cx(s.dot, i === index % count && s.dotActive)}
              aria-label={`Слайд ${i + 1}: ${item.title}`}
              aria-current={i === index % count}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        <div className={s.arrows}>
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
      <div className={s.options}>
        {all.map((item) => (
          <label key={item.id} className={s.option}>
            <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
            {item.title}
          </label>
        ))}
      </div>
      <div className={s.modalActions}>
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
    <section className={s.panel} aria-label="Быстрые действия">
      <div className={s.panelHead}>
        <h3>Когда нужно быстрое решение</h3>
        <button
          type="button"
          className={s.settings}
          onClick={() => setEditing(true)}
          disabled={!data}
          aria-label="Настроить подборку"
        >
          <Settings2 size={16} aria-hidden />
          Настроить<span className={s.settingsExtra}> подборку</span>
        </button>
      </div>
      {isPending && <Skeleton height={88} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      <div className={s.chips} style={{ '--cols': columns } as CSSProperties}>
        {visible.map((item) => (
          <HrefLink key={item.id} href={item.href} className={s.quick} title={item.title}>
            <span className={s.quickText}>{item.title}</span>
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
    <section className={s.panel} aria-label="Дни рождения">
      <div className={s.panelHead}>
        <h3>Дни рождения</h3>
      </div>
      {isPending && <Skeleton height={88} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      <div className={s.birthdays}>
        {data?.map(({ person, date }) => (
          <div key={person.id} className={s.birthday}>
            <Avatar firstName={person.firstName} lastName={person.lastName} palette={person.palette} size={56} />
            <span>{person.firstName}</span>
            <span className={s.birthdayDate}>{formatDayMonthShort(date)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

const DOCS = [
  { id: 'edo', title: 'ЭДО', emoji: '📄' },
  { id: 'vacation', title: 'Справки и отпуск', emoji: '🗂️' },
  { id: 'trip', title: 'Командировки', emoji: '🧳' },
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
                <Emoji size={52} className={s.tileArt}>
                  {SERVICE_EMOJI[service.icon]}
                </Emoji>
              </Link>
            ))}
          </div>
          <div className={s.docs}>
            <h3>Документы</h3>
            <div className={s.docsItems}>
              {DOCS.map((doc) => (
                <Link key={doc.id} to="/services/$serviceId" params={{ serviceId: doc.id }} className={s.docsItem}>
                  <span className={s.docsIcon}>
                    <Emoji size={34}>{doc.emoji}</Emoji>
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
          <Emoji size={76} className={s.promoArt}>
            {promo.emoji}
          </Emoji>
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
            <Emoji size={72} className={s.plusArt}>
              {category.emoji}
            </Emoji>
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
