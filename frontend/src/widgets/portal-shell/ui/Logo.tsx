import { Link } from '@/shared/lib/portal-navigation'

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
    <Link
      to="/"
      className="mr-12 inline-flex min-w-25.75 shrink-0 items-center gap-1.5 text-30 leading-none font-bold hub-max-720:col-start-1 hub-max-720:row-start-1 hub-max-720:mr-0 hub-max-720:min-w-0 hub-max-720:text-26"
      aria-label="На главную"
    >
      <LogoMark className="size-8 hub-max-720:size-7" />
      <span>{APP_NAME}</span>
    </Link>
  )
}
