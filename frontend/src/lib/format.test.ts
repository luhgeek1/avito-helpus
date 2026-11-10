import { describe, expect, it } from 'vitest'
import { formatDayMonthShort, formatNumber, formatRelative, initials, plural, toDateKey } from './format'

describe('plural', () => {
  const forms: [string, string, string] = ['подписчик', 'подписчика', 'подписчиков']

  it.each([
    [1, 'подписчик'],
    [2, 'подписчика'],
    [5, 'подписчиков'],
    [11, 'подписчиков'],
    [14, 'подписчиков'],
    [21, 'подписчик'],
    [104, 'подписчика'],
    [0, 'подписчиков'],
  ])('%i → %s', (n, expected) => {
    expect(plural(n, forms)).toBe(expected)
  })
})

describe('formatRelative', () => {
  const now = new Date('2026-11-10T12:00:00')
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

  it('formats recent moments', () => {
    expect(formatRelative(ago(10_000), now)).toBe('только что')
    expect(formatRelative(ago(5 * 60_000), now)).toBe('5 минут назад')
    expect(formatRelative(ago(3 * 3_600_000), now)).toBe('3 часа назад')
  })

  it('formats yesterday and older dates', () => {
    expect(formatRelative(ago(30 * 3_600_000), now)).toMatch(/^вчера в \d{2}:\d{2}$/)
    expect(formatRelative('2026-10-01T10:00:00', now)).toBe('1 октября')
  })
})

describe('helpers', () => {
  it('builds a local date key', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('builds initials', () => {
    expect(initials('даниил', 'орлов')).toBe('ДО')
  })

  it('formats numbers and short dates', () => {
    expect(formatNumber(48210)).toMatch(/48\s210/)
    expect(formatDayMonthShort('2026-11-14T12:00:00')).toBe('14 нояб')
  })
})
