import type { CSSProperties } from 'react'
import type { Illustration as IllustrationName } from '@/shared/api'
import { cx } from './classes'
import s from './ui.styles'

type IllustrationProps = { name: IllustrationName; size: number; className?: string; style?: CSSProperties }

/** 3D-rendered illustration with a baked soft shadow; decorative only. */
export function Illustration({ name, size, className, style }: IllustrationProps) {
  return (
    <img
      src={`/portal/illustrations/${name}.webp`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className={cx(s.illustration, className)}
      style={style}
    />
  )
}
