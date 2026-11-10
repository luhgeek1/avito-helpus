import { Link } from '@tanstack/react-router'
import s from './layout.module.css'

export const APP_NAME = 'Хаб'

/**
 * Собственный знак портала: «хаб» — центр, связанный с сервисами вокруг, на синем фоне Авито.
 * Нарочно не похож на логотип Авито из четырёх кругов: официальный знак можно взять
 * только у бренд-команды.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="10" fill="#00AAFF" />
      <path d="M16 16 9.5 9.5M16 16l6.5-6.5M16 16l-6.5 6.5M16 16l6.5 6.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="9" r="2.5" fill="#fff" />
      <circle cx="23" cy="9" r="2.5" fill="#fff" />
      <circle cx="9" cy="23" r="2.5" fill="#fff" />
      <circle cx="23" cy="23" r="2.5" fill="#fff" />
      <circle cx="16" cy="16" r="4.5" fill="#fff" />
    </svg>
  )
}

export function Logo() {
  return (
    <Link to="/" className={s.logo} aria-label="На главную">
      <LogoMark className={s.logoMark} />
      <span className={s.logoText}>{APP_NAME}</span>
    </Link>
  )
}
