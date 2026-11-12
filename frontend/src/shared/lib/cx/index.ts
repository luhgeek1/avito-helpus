import { extendTailwindMerge } from 'tailwind-merge'

const merge = extendTailwindMerge({
  extend: {
    theme: {
      // Pixel font sizes from tailwind.config.ts: text-7 … text-42.
      text: Array.from({ length: 36 }, (_, i) => String(i + 7)),
      shadow: ['float', 'pop'],
      ease: ['button'],
    },
  },
  // Custom text-* sizes carry no line height, so a leading-* class always survives them.
  override: { conflictingClassGroups: { 'font-size': [] } },
})

/** Joins class names; a later utility overrides an earlier one from the same group. */
export const cx = (...names: (string | false | null | undefined)[]) => merge(names.filter(Boolean).join(' '))
