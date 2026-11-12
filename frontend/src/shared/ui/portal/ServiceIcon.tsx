import type { Illustration, ServiceIcon as ServiceIconName } from '@/shared/api'
import { cx } from './classes'
import { Illustration as IllustrationImage } from './Illustration'

export const SERVICE_ILLUSTRATION: Record<ServiceIconName, Illustration> = {
  game: 'gamepad',
  seat: 'chair',
  rotation: 'rotation',
  growth: 'chart',
  learning: 'grad-cap',
  docs: 'document',
  vacation: 'beach',
  trip: 'suitcase',
  access: 'key',
  it: 'laptop',
  merch: 'tshirt',
  health: 'stethoscope',
  sport: 'dumbbell',
  food: 'food-bowl',
  parking: 'car',
  gift: 'gift',
  psy: 'couch',
  library: 'books',
  checklist: 'checklist',
}

/** Иконка сервиса: 3D-иллюстрация на светлой плашке, как иконки в блоке «Всё для бизнеса» на Авито. */
export function ServiceIcon({ icon, size = 48, className }: { icon: ServiceIconName; size?: number; className?: string }) {
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center bg-fill leading-none', className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
      aria-hidden
    >
      <IllustrationImage name={SERVICE_ILLUSTRATION[icon]} size={Math.round(size * 0.9)} />
    </span>
  )
}
