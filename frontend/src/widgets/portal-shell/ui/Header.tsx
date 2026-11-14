import { Link, useNavigate, useRouterState } from '@/shared/lib/portal-navigation'
import { Bell, FileText, Heart, LayoutGrid, LogIn, LogOut, Navigation, Plus, Search } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  useMarkNotificationsRead, useMe, useNotifications, useOrbiMe, useOrbiNotifications, useReadNotifications, useSession,
} from '@/shared/api'
import { formatRelative } from '@/shared/lib/portal-format'
import { initialsOf } from '@/shared/lib/orbi-format'
import { Button, buttonClass, container, cx, heading, HrefLink } from '@/shared/ui/portal'
import { Logo } from './Logo'

const ORBI_LINKS = [
  { to: '/plan', title: 'Мой путь', permission: 'plan:own', roles: ['intern'] },
  { to: '/requests', title: 'Заявки', permission: 'requests:own', roles: ['intern'] },
  { to: '/mentor', title: 'Стажёры', permission: 'mentees:read', roles: ['mentor', 'lead', 'hrbp', 'admin'] },
] as const

const TOP_LINKS = [
  { to: '/services', title: 'Сервисы' },
  { to: '/events', title: 'События' },
  { to: '/feed', title: 'Лента' },
  { to: '/benefits/savings', title: 'Плюсы' },
  { to: '/ai', title: 'ИИ в Авито' },
] as const

const iconAction =
  'relative inline-flex h-11 w-12.5 items-center justify-center rounded-xl border-0 bg-transparent text-[#ccc] hover:text-secondary'
const topAction = 'inline-flex h-10 items-center gap-1.5 whitespace-nowrap px-2 text-primary hover:text-link-hover hub-max-1000:hidden'
const topLink = cx(
  'inline-flex h-8 items-center rounded-lg px-2 text-secondary hover:text-link-hover',
  'hub-max-720:h-9 hub-max-720:whitespace-nowrap hub-max-720:rounded-xl hub-max-720:bg-control hub-max-720:px-3.5 hub-max-720:text-primary hub-max-720:hover:text-primary',
)
const topLinkActive = 'text-primary hub-max-720:bg-dark hub-max-720:text-white hub-max-720:hover:bg-dark hub-max-720:hover:text-white'

function SearchBox({ initial }: { initial: string }) {
  const navigate = useNavigate()
  const [value, setValue] = useState(initial)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const q = value.trim()
    if (q) void navigate({ to: '/search', search: { q } })
  }

  return (
    <form
      className="ml-1.5 flex h-13 min-w-0 flex-1 items-center rounded-2xl bg-blue p-0.5 hub-max-720:col-span-2 hub-max-720:row-start-2 hub-max-720:mx-0 hub-max-720:mt-2 hub-max-720:h-11 hub-max-720:rounded-[14px]"
      role="search"
      onSubmit={onSubmit}>
      <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-[14px] bg-white px-4 text-secondary hub-max-720:h-10 hub-max-720:rounded-xl">
        <Search size={18} aria-hidden />
        <input
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-primary outline-none placeholder:text-secondary [&::-webkit-search-cancel-button]:cursor-pointer"
          type="search"
          placeholder="Поиск по людям, сервисам и событиям"
          aria-label="Поиск по порталу"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button
        type="submit"
        className="h-12 rounded-[14px] border-0 bg-transparent pr-4.75 pl-4.5 text-white transition-colors duration-150 ease-button hover:bg-blue-hover active:bg-blue-pressed hub-max-720:hidden"
      >
        Найти
      </button>
    </form>
  )
}

type NoticeItem = { id: string; title: string; text: string; href: string; read: boolean; createdAt: string }

/** Backend links point at product routes; unknown ones open the home page. */
function orbiHref(link: string | null): string {
  return link && link.startsWith('/') ? link : '/'
}

function OrbiNotifications() {
  const { data } = useOrbiNotifications()
  const read = useReadNotifications()
  const items: NoticeItem[] = (data?.items ?? []).map((item) => ({
    id: item.id, title: item.title, text: item.body, href: orbiHref(item.link), read: item.read_at !== null, createdAt: item.created_at,
  }))
  return <NotificationsPanel items={items} unread={data?.unread ?? 0} pending={read.isPending}
    onReadAll={() => read.mutate(undefined)} onOpen={(id) => read.mutate(id)} empty="Новых уведомлений нет. Орби напишет, когда по заявке будет решение." />
}

function PortalNotifications() {
  const { data } = useNotifications()
  const markRead = useMarkNotificationsRead()
  const items: NoticeItem[] = (data ?? []).map((item) => ({
    id: item.id, title: item.title, text: item.text, href: item.href ?? '/', read: item.read, createdAt: item.createdAt,
  }))
  return <NotificationsPanel items={items} unread={items.filter((item) => !item.read).length} pending={markRead.isPending}
    onReadAll={() => markRead.mutate()} />
}

function Notifications() {
  const authed = useSession((state) => state.status === 'authenticated')
  return authed ? <OrbiNotifications /> : <PortalNotifications />
}

function NotificationsPanel({ items, unread, pending, onReadAll, onOpen, empty }: {
  items: NoticeItem[]; unread: number; pending: boolean; onReadAll: () => void; onOpen?: (id: string) => void; empty?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Панель остаётся в DOM, пока проигрывается анимация закрытия.
  const [closing, setClosing] = useState(false)
  const close = () => {
    setOpen(false)
    setClosing(true)
  }
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close()
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={iconAction}
        aria-label={unread ? `Уведомления: ${unread} новых` : 'Уведомления'}
        aria-expanded={open}
        onClick={() => (open ? close() : (setClosing(false), setOpen(true)))}
      >
        <Bell size={28} fill="currentColor" />
        {unread > 0 && <span className="absolute top-0.5 left-6.75 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red px-1 text-11 leading-none font-bold text-white tabular-nums">{unread}</span>}
      </button>
      {(open || closing) && (
        <div
          className={cx(
            'absolute top-[calc(100%+8px)] right-0 z-60 w-95 max-w-[calc(100vw-32px)] animate-hub-layout-drop rounded-3xl bg-white p-2 shadow-pop',
            closing && 'pointer-events-none animate-hub-layout-lift',
          )}
          role="dialog"
          aria-label="Уведомления"
          aria-hidden={closing || undefined}
          onAnimationEnd={(event) => event.target === event.currentTarget && setClosing(false)}
        >
          <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
            <h3 className={heading.h3}>Уведомления</h3>
            {unread > 0 && (
              <Button variant="ghost" size="s" onClick={onReadAll} disabled={pending}>
                Прочитать все
              </Button>
            )}
          </div>
          {items.length === 0 && empty && <p className="px-3 pt-1 pb-3 text-secondary">{empty}</p>}
          <div className="max-h-[min(480px,calc(100vh-160px))] overflow-y-auto">
          {items.map((item) => (
            <HrefLink key={item.id} href={item.href} className="block rounded-2xl p-3 transition-colors duration-150 ease-out hover:bg-fill hover:duration-200"
              onClick={() => { if (!item.read) onOpen?.(item.id); close() }}
            >
              <div className="flex items-center gap-2 font-bold">
                {!item.read && <span className="size-2 shrink-0 rounded-full bg-blue" aria-label="Новое" />}
                {item.title}
              </div>
              <p className="my-0.5 text-secondary">{item.text}</p>
              <span className="text-13 text-tertiary">{formatRelative(item.createdAt)}</span>
            </HrefLink>
          ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Account() {
  const status = useSession((state) => state.status)
  const logout = useSession((state) => state.logout)
  const { data: me } = useOrbiMe()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])
  if (status === 'anonymous') {
    return (
      <Link to="/login" className="ml-2 inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue px-3.5 font-bold text-white hover:bg-blue-hover">
        <LogIn size={16} aria-hidden /> Войти
      </Link>
    )
  }
  if (status === 'unknown' || !me) {
    return <span className="ml-2 block size-8 rounded-full bg-control" aria-hidden />
  }
  return (
    <div className="relative ml-2" ref={ref}>
      <button type="button" aria-expanded={open} aria-label={`Аккаунт: ${me.full_name}`} onClick={() => setOpen(!open)}
        className="grid size-8 place-items-center rounded-full bg-blue-soft text-12 font-bold text-blue-text">
        {initialsOf(me.full_name)}
      </button>
      {open && (
        <div role="menu" aria-label="Аккаунт" className="absolute top-[calc(100%+8px)] right-0 z-60 w-70 animate-hub-layout-drop rounded-3xl bg-white p-2 shadow-pop">
          <div className="px-3 pt-2.5 pb-2">
            <p className="font-bold">{me.full_name}</p>
            <p className="text-13 text-secondary">{me.role_title}{me.team ? ` · ${me.team.name}` : ''}</p>
          </div>
          <Link to="/profile" role="menuitem" className="block rounded-2xl px-3 py-2.5 hover:bg-fill" onClick={() => setOpen(false)}>Профиль на портале</Link>
          <Link to="/login" role="menuitem" className="block rounded-2xl px-3 py-2.5 hover:bg-fill" onClick={() => setOpen(false)}>Сменить учётку</Link>
          <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-red-text hover:bg-fill"
            onClick={() => { setOpen(false); void logout() }}>
            <LogOut size={16} aria-hidden /> Выйти
          </button>
        </div>
      )}
    </div>
  )
}

function useTopLinks() {
  const { data: me } = useOrbiMe()
  const orbi = me ? ORBI_LINKS.filter((link) => me.permissions.includes(link.permission) && (link.roles as readonly string[]).includes(me.role)) : []
  return [...orbi, ...TOP_LINKS]
}

export function Header() {
  const { data: me } = useMe()
  const links = useTopLinks()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const routerQuery = useRouterState({
    select: (state) =>
      state.location.pathname === '/search' ? String((state.location.search as { q?: string }).q ?? '') : '',
  })

  return (
    <header className="sticky top-0 z-30 bg-white hub-max-720:grid hub-max-720:grid-cols-[minmax(0,1fr)_auto] hub-max-720:items-center hub-max-720:px-4 hub-max-720:pt-1.5">
      <div className={cx(container, 'flex h-13.5 items-center justify-between gap-6 pt-2.5 hub-max-720:contents')}>
        <nav className="hub-max-720:col-span-2 hub-max-720:row-start-3 hub-max-720:-mx-4 hub-max-720:min-w-0" aria-label="Разделы портала">
          <ul className="-mx-2 flex items-center hub-max-720:m-0 hub-max-720:scrollbar-none hub-max-720:gap-2 hub-max-720:overflow-x-auto hub-max-720:px-4 hub-max-720:py-3">
            {links.map((link) => (
              <li key={link.to}>
                <HrefLink href={link.to} className={cx(topLink, pathname.startsWith(link.to) && topLinkActive)}>
                  {link.title}
                </HrefLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center hub-max-720:col-start-2 hub-max-720:row-start-1">
          <Link to="/services/$serviceId" params={{ serviceId: 'it' }} className={topAction}>
            <Plus size={18} aria-hidden />
            <span>Заявка в IT-поддержку</span>
          </Link>
          <Link to="/services/$serviceId" params={{ serviceId: 'edo' }} className={topAction}>
            <FileText size={18} aria-hidden />
            <span>Мои документы</span>
          </Link>
          <Link to="/feed" className={cx(iconAction, 'hub-max-720:hidden')} aria-label="Подписки" title="Подписки">
            <Heart size={28} fill="currentColor" />
          </Link>
          <Notifications />
          <Account />
        </div>
      </div>
      <div className={cx(container, 'flex items-center pt-1 pb-2 hub-max-720:contents')}>
        <Logo />
        <Link to="/services" className={cx(buttonClass('accent', 'l'), 'shrink-0 hub-max-720:hidden')} aria-label="Все сервисы">
          <LayoutGrid size={18} aria-hidden />
          <span>Все сервисы</span>
        </Link>
        <SearchBox key={routerQuery} initial={routerQuery} />
        <span className="ml-12 inline-flex w-50 shrink-0 items-center gap-1.5 whitespace-nowrap hub-max-1000:hidden">
          <Navigation size={16} fill="currentColor" aria-hidden />
          {me?.city ?? 'Москва'}
        </span>
      </div>
    </header>
  )
}
