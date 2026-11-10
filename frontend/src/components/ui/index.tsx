import { Link } from '@tanstack/react-router'
import { ChevronRight, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import type { Palette } from '../../api/schemas'
import { initials } from '../../lib/format'
import { buttonClass, cx, type ButtonSize, type ButtonVariant } from './classes'
import s from './ui.module.css'

export { buttonClass, chipClass, cx } from './classes'

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
      className={cx(s.avatar, `palette-${palette}`, className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      role="img"
      aria-label={`${firstName} ${lastName}`}
    >
      {initials(firstName, lastName)}
    </span>
  )
}

/* ---------- Иллюстрации ---------- */

/** Объёмный эмодзи — замена 3D-иллюстрациям Авито. */
export function Emoji({ children, size, className, style }: { children: string; size: number; className?: string; style?: CSSProperties }) {
  return (
    <span className={cx(s.emoji, className)} style={{ fontSize: size, ...style }} aria-hidden>
      {children}
    </span>
  )
}

type CoverProps = {
  emoji: string
  palette: Palette
  ratio?: string
  emojiSize?: number
  badge?: ReactNode
  className?: string
}

/** Обложка карточки: светлый фон палитры и крупная иллюстрация, как фото товара на Авито. */
export function Cover({ emoji, palette, ratio = '1 / 1', emojiSize = 72, badge, className }: CoverProps) {
  return (
    <div className={cx(s.cover, `palette-${palette}`, className)} style={{ aspectRatio: ratio }}>
      <Emoji size={emojiSize}>{emoji}</Emoji>
      {badge && <span className={s.coverBadge}>{badge}</span>}
    </div>
  )
}

/* ---------- Заголовок секции ---------- */

export function SectionHead({ title, href, linkText }: { title: ReactNode; href?: string; linkText?: string }) {
  return (
    <div className={s.sectionHead}>
      <h2>{title}</h2>
      {href && linkText && (
        <HrefLink href={href} className={s.sectionLink}>
          {linkText}
          <ChevronRight size={16} aria-hidden />
        </HrefLink>
      )}
    </div>
  )
}

/* ---------- Состояния ---------- */

export function Skeleton({ height, width = '100%', radius }: { height: number; width?: number | string; radius?: number }) {
  return <div className={s.skeleton} style={{ height, width, borderRadius: radius }} aria-hidden />
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className={s.error} role="alert">
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
  return <div className={s.empty}>{children}</div>
}

/* ---------- Чип ---------- */

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }

export function Chip({ active, className, type = 'button', ...rest }: ChipProps) {
  return <button type={type} className={cx(s.chip, active && s.chipActive, className)} aria-pressed={active} {...rest} />
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
    <div className={s.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-label={title}>
        <div className={s.modalHead}>
          <h3>{title}</h3>
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
  return <button type="button" aria-label={label} title={label} className={cx(s.iconButton, className)} {...rest} />
}
