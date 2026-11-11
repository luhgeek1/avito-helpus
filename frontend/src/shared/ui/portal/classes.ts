import s from './ui.styles'

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ')

/** accent — синяя кнопка ключевого действия, primary — чёрная основная, как на avito.ru. */
export type ButtonVariant = 'accent' | 'primary' | 'success' | 'secondary' | 'white' | 'ghost'
export type ButtonSize = 's' | 'm' | 'l'

/** Классы кнопки — для ссылок, которые выглядят как кнопки. */
export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'm') =>
  cx(s.button, s[variant], s[`size-${size}`])

export const chipClass = s.chip
