import { Link } from '@/shared/lib/portal-navigation'
import { buttonClass, container, cx, heading } from '@/shared/ui/portal'

export function NotFoundPage() {
  return (
    // The original 64px 0 padding replaced the column gutter, so the block spans the full width.
    <div className={cx(container, 'flex flex-col items-center gap-3 px-0 py-16 text-center hub-max-720:px-0')}>
      <span className="text-[120px] leading-none font-bold text-blue" aria-hidden>
        404
      </span>
      <h1 className={heading.h1}>Такой страницы нет</h1>
      <p className="mb-3 text-secondary">Возможно, ссылка устарела или страницу перенесли</p>
      <Link to="/" className={buttonClass('primary', 'l')}>
        На главную
      </Link>
    </div>
  )
}
