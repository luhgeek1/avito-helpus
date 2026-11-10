import { Link } from '@tanstack/react-router'
import { buttonClass } from '../components/ui'
import s from './pages.module.css'

export function NotFoundPage() {
  return (
    <div className={`container ${s.notFound}`}>
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
