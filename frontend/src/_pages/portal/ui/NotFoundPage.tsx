import { portalGlobals } from '@/shared/ui/portal'
import { Link } from '@/shared/lib/portal-navigation'
import { buttonClass } from '@/shared/ui/portal'
import s from './pages.styles'

export function NotFoundPage() {
  return (
    <div className={`${portalGlobals.container} ${s.notFound}`}>
      <span className={s.notFoundCode} aria-hidden>
        404
      </span>
      <h1>Такой страницы нет</h1>
      <p>Возможно, ссылка устарела или страницу перенесли</p>
      <Link to="/" className={buttonClass('primary', 'l')}>
        На главную
      </Link>
    </div>
  )
}
