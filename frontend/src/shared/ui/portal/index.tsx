import { Link } from '@/shared/lib/portal-navigation'
import { ChevronRight, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react'
import type { Illustration as IllustrationName, Palette } from '@/shared/api'
import { initials } from '@/shared/lib/portal-format'
import { buttonClass, chipClass, cx, heading, paletteClass, type ButtonSize, type ButtonVariant } from './classes'
import { Illustration } from './Illustration'

export { buttonClass, chipClass, container, cx, heading, paletteClass } from './classes'

/* ---------- Ссылка на путь из данных ---------- */

type HrefLinkProps = Omit<ComponentProps<typeof Link>, 'to'> & { href: string }

/** Ссылка на путь, который пришёл из API (строкой), а не задан в коде. */
export function HrefLink({ href, ...rest }: HrefLinkProps) {
  return <Link to={href as never} {...rest} />
}

/* ---------- Кнопка ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }

export function Button({ variant = 'primary', size = 'm', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx(buttonClass(variant, size), className)} {...rest} />
}

/* ---------- Аватар ---------- */

type AvatarProps = {
  firstName: string
  lastName: string
  palette: Palette
  size?: number
  className?: string
}

export function Avatar({ firstName, lastName, palette, size = 40, className }: AvatarProps) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-tone-soft font-bold text-tone-text',
        paletteClass[palette],
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      role="img"
      aria-label={`${firstName} ${lastName}`}
    >
      {initials(firstName, lastName)}
    </span>
  )
}

/* ---------- Иллюстрации ---------- */

type CoverProps = {
  illustration: IllustrationName
  palette: Palette
  ratio?: string
  badge?: ReactNode
  className?: string
}

/** Обложка карточки: светлый фон палитры и крупная иллюстрация на 84 % высоты, как фото товара на Авито. */
export function Cover({ illustration, palette, ratio = '1 / 1', badge, className }: CoverProps) {
  return (
    <div className={cx(
        'relative flex items-center justify-center overflow-hidden rounded-2xl bg-tone-soft',
        paletteClass[palette],
        className,
      )}
       style={{ aspectRatio: ratio }}>
      <Illustration
        name={illustration}
        size={480}
        // With a badge the art drops lower so the top-left label never covers it.
        style={badge ? { height: '78%', width: 'auto', marginTop: '18%' } : { height: '84%', width: 'auto' }}
      />
      {badge && <span className="absolute top-2.5 left-2.5 inline-flex h-6 items-center gap-1.5 rounded-md bg-black/44 px-2 text-13 leading-4 text-white">{badge}</span>}
    </div>
  )
}

/* ---------- Заголовок секции ---------- */

export function SectionHead({ title, href, linkText }: { title: ReactNode; href?: string; linkText?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className={heading.h2}>{title}</h2>
      {href && linkText && (
        <HrefLink href={href} className="inline-flex items-center gap-0.5 whitespace-nowrap text-link hover:text-link-hover">
          {linkText}
          <ChevronRight size={16} aria-hidden />
        </HrefLink>
      )}
    </div>
  )
}

/* ---------- Состояния ---------- */

export function Skeleton({ height, width = '100%', radius }: { height: number; width?: number | string; radius?: number }) {
  return <div
      className="animate-hub-ui-shimmer rounded-2xl bg-[linear-gradient(90deg,#f2f2f2_0%,#f9f9f9_50%,#f2f2f2_100%)] bg-size-[200%_100%]"
      style={{ height, width, borderRadius: radius }} aria-hidden />
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-red-soft px-4 py-3.5" role="alert">
      <span>{message ?? 'Не удалось загрузить данные'}</span>
      {onRetry && (
        <Button variant="white" size="s" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-3xl bg-fill p-8 text-center text-secondary">{children}</div>
}

/* ---------- Чип ---------- */

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }

export function Chip({ active, className, type = 'button', ...rest }: ChipProps) {
  return <button type={type} className={cx(chipClass, active && 'bg-dark text-white hover:bg-dark active:bg-dark', className)} aria-pressed={active} {...rest} />
}

/* ---------- Модалка ---------- */

type ModalProps = { title: string; onClose: () => void; children: ReactNode }

export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-100 flex animate-hub-ui-fade items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="max-h-[calc(100vh-32px)] w-full max-w-120 animate-hub-ui-rise overflow-auto rounded-3xl bg-white p-6 shadow-pop"
        role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className={heading.h3}>{title}</h3>
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}

export function IconButton({
  label,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} title={label} className={cx(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-secondary',
        'transition-colors duration-150 ease-out hover:bg-fill-hover hover:text-primary hover:duration-200',
        className,
      )} {...rest} />
}

export { Illustration } from './Illustration';
export { ServiceIcon, SERVICE_ILLUSTRATION } from './ServiceIcon';
export { default as portalGlobals } from './global.styles';
