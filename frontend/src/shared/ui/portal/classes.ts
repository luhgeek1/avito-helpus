import type { Palette } from '@/shared/api'
import { cx } from '@/shared/lib/cx'

export { cx }

/** Page column with the portal gutter: 24px, 16px on phones. */
export const container = 'mx-auto w-full max-w-341 px-6 hub-max-720:max-w-337 hub-max-720:px-4'

/** Sets the tone-* colours for a card, avatar or badge. */
export const paletteClass: Record<Palette, string> = {
  blue: 'palette-blue',
  green: 'palette-green',
  red: 'palette-red',
  purple: 'palette-purple',
  dark: 'palette-dark',
}

/** accent — синяя кнопка ключевого действия, primary — чёрная основная, как на avito.ru. */
export type ButtonVariant = 'accent' | 'primary' | 'success' | 'secondary' | 'white' | 'ghost'
export type ButtonSize = 's' | 'm' | 'l'

const buttonVariants: Record<ButtonVariant, string> = {
  accent: 'bg-blue text-white not-disabled:hover:bg-blue-hover not-disabled:active:bg-blue-pressed',
  primary: 'bg-dark text-white not-disabled:hover:bg-dark-hover not-disabled:active:bg-dark',
  success: 'bg-green text-white not-disabled:hover:bg-green-hover not-disabled:active:bg-green-pressed',
  secondary: 'bg-control text-primary not-disabled:hover:bg-control-hover not-disabled:active:bg-control-pressed',
  white: 'bg-white text-primary shadow-float not-disabled:active:bg-white-pressed',
  ghost: 'bg-transparent text-link not-disabled:hover:text-link-hover',
}

const buttonSizes: Record<ButtonSize, string> = {
  s: 'h-9 pr-3.75 pl-3.5 text-13 rounded-xl',
  m: 'h-11 pr-4.25 pl-4 text-15 rounded-xl',
  l: 'h-13 pr-4.75 pl-4.5 text-15 rounded-2xl',
}

/** Классы кнопки — для ссылок, которые выглядят как кнопки. */
export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'm') =>
  cx(
    'inline-flex items-center justify-center gap-2 border-0 font-normal whitespace-nowrap',
    'transition-colors duration-150 ease-button disabled:cursor-default disabled:opacity-50',
    buttonVariants[variant],
    buttonSizes[size],
  )

export const chipClass = cx(
  'inline-flex h-10 items-center gap-1.5 rounded-xl border-0 bg-control px-4 text-15',
  'transition-colors duration-150 ease-out hover:bg-control-hover hover:duration-200 active:bg-control-pressed',
)

/** Portal heading scale: 32/36, 26/30 and 18/22, smaller on phones. */
export const heading = {
  h1: 'text-32 leading-9 font-bold hub-max-720:text-26 hub-max-720:leading-7.5',
  h2: 'text-26 leading-7.5 font-bold hub-max-720:text-22 hub-max-720:leading-6.5',
  h3: 'text-18 leading-5.5 font-bold',
}
