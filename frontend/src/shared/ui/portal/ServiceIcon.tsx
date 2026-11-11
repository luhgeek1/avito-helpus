import type { ServiceIcon as ServiceIconName } from '@/shared/api'
import { cx } from './classes'
import s from './ui.styles'

export const SERVICE_EMOJI: Record<ServiceIconName, string> = {
  game: '🎮',
  seat: '🪑',
  rotation: '🔄',
  growth: '📈',
  learning: '🎓',
  docs: '📄',
  vacation: '🏖️',
  trip: '🧳',
  access: '🔑',
  it: '💻',
  merch: '👕',
  health: '🩺',
  sport: '🏋️',
  food: '🍝',
  parking: '🚗',
  gift: '🎁',
  psy: '🧠',
  library: '📚',
  checklist: '✅',
}

/** Иконка сервиса: эмодзи на светлой плашке, как иконки в блоке «Всё для бизнеса» на Авито. */
export function ServiceIcon({ icon, size = 48, className }: { icon: ServiceIconName; size?: number; className?: string }) {
  return (
    <span
      className={cx(s.serviceIcon, className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
      aria-hidden
    >
      <span className={s.emoji} style={{ fontSize: Math.round(size * 0.56) }}>
        {SERVICE_EMOJI[icon]}
      </span>
    </span>
  )
}
