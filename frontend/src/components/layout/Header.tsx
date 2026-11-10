import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Bell, FileText, Heart, LayoutGrid, Navigation, Plus, Search } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMarkNotificationsRead, useMe, useNotifications } from '../../api/queries'
import { formatRelative } from '../../lib/format'
import { Avatar, Button, buttonClass, cx, HrefLink } from '../ui'
import { Logo } from './Logo'
import s from './layout.module.css'

const TOP_LINKS = [
  { to: '/services', title: 'Сервисы' },
  { to: '/events', title: 'События' },
  { to: '/feed', title: 'Лента' },
  { to: '/benefits/savings', title: 'Плюсы' },
  { to: '/ai', title: 'ИИ в Авито' },
] as const

function SearchBox({ initial }: { initial: string }) {
  const navigate = useNavigate()
  const [value, setValue] = useState(initial)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const q = value.trim()
    if (q) void navigate({ to: '/search', search: { q } })
  }

  return (
    <form className={s.search} role="search" onSubmit={onSubmit}>
      <label className={s.searchField}>
        <Search size={18} aria-hidden />
        <input
          className={s.searchInput}
          type="search"
          placeholder="Поиск по людям, сервисам и событиям"
          aria-label="Поиск по порталу"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button type="submit" className={s.searchSubmit}>
        Найти
      </button>
    </form>
  )
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data } = useNotifications()
  const markRead = useMarkNotificationsRead()
  const unread = data?.filter((item) => !item.read).length ?? 0

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={s.popover} ref={ref}>
      <button
        type="button"
        className={s.iconAction}
        aria-label={unread ? `Уведомления: ${unread} новых` : 'Уведомления'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={28} fill="currentColor" />
        {unread > 0 && <span className={s.badge}>{unread}</span>}
      </button>
      {open && (
        <div className={s.panel} role="dialog" aria-label="Уведомления">
          <div className={s.panelHead}>
            <h3>Уведомления</h3>
            {unread > 0 && (
              <Button variant="ghost" size="s" onClick={() => markRead.mutate()} disabled={markRead.isPending}>
                Прочитать все
              </Button>
            )}
          </div>
          {data?.map((item) => (
            <HrefLink key={item.id} href={item.href ?? '/'} className={s.notification} onClick={() => setOpen(false)}>
              <div className={s.notificationTitle}>
                {!item.read && <span className={s.unreadDot} aria-label="Новое" />}
                {item.title}
              </div>
              <p className={s.notificationText}>{item.text}</p>
              <span className={s.notificationTime}>{formatRelative(item.createdAt)}</span>
            </HrefLink>
          ))}
        </div>
      )}
    </div>
  )
}

export function Header() {
  const { data: me } = useMe()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const routerQuery = useRouterState({
    select: (state) =>
      state.location.pathname === '/search' ? String((state.location.search as { q?: string }).q ?? '') : '',
  })

  return (
    <header className={s.header}>
      <div className={`container ${s.topBar}`}>
        <nav aria-label="Разделы портала">
          <ul className={s.topLinks}>
            {TOP_LINKS.map((link) => (
              <li key={link.to}>
                <HrefLink href={link.to} className={cx(s.topLink, pathname.startsWith(link.to) && s.topLinkActive)}>
                  {link.title}
                </HrefLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className={s.topActions}>
          <Link to="/services/$serviceId" params={{ serviceId: 'it' }} className={s.action}>
            <Plus size={18} aria-hidden />
            <span className={s.topActionText}>Заявка в IT</span>
          </Link>
          <Link to="/services/$serviceId" params={{ serviceId: 'edo' }} className={s.action}>
            <FileText size={18} aria-hidden />
            <span className={s.topActionText}>Мои документы</span>
          </Link>
          <Link to="/feed" className={s.iconAction} aria-label="Подписки" title="Подписки">
            <Heart size={28} fill="currentColor" />
          </Link>
          <Notifications />
          <Link to="/profile" className={s.avatarLink} aria-label="Мой профиль">
            {me ? (
              <Avatar firstName={me.firstName} lastName={me.lastName} palette={me.palette} size={32} />
            ) : (
              <span style={{ display: 'block', width: 32, height: 32 }} />
            )}
          </Link>
        </div>
      </div>
      <div className={`container ${s.mainBar}`}>
        <Logo />
        <Link to="/services" className={cx(buttonClass('accent', 'l'), s.allServices)} aria-label="Все сервисы">
          <LayoutGrid size={18} aria-hidden />
          <span className={s.allServicesText}>Все сервисы</span>
        </Link>
        <SearchBox key={routerQuery} initial={routerQuery} />
        <span className={s.location}>
          <Navigation size={16} fill="currentColor" aria-hidden />
          {me?.city ?? 'Москва'}
        </span>
      </div>
    </header>
  )
}
