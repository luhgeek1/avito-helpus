const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const dayMonthShort = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const weekdayShort = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })
const number = new Intl.NumberFormat('ru-RU')

export const formatDayMonth = (iso: string) => dayMonth.format(new Date(iso))
export const formatDayMonthShort = (iso: string) => dayMonthShort.format(new Date(iso)).replace('.', '')
export const formatTime = (iso: string) => time.format(new Date(iso))
export const formatWeekday = (date: Date) => weekdayShort.format(date)
export const formatNumber = (value: number) => number.format(value)
export const formatDateTime = (iso: string) => `${formatDayMonth(iso)}, ${formatTime(iso)}`

/** Русское склонение: plural(5, ['подписчик', 'подписчика', 'подписчиков']) → «подписчиков». */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

export function formatRelative(iso: string, now = new Date()): string {
  const diffMinutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (diffMinutes < 1) return 'только что'
  if (diffMinutes < 60) return `${diffMinutes} ${plural(diffMinutes, ['минуту', 'минуты', 'минут'])} назад`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} ${plural(diffHours, ['час', 'часа', 'часов'])} назад`
  if (diffHours < 48) return `вчера в ${formatTime(iso)}`
  return formatDayMonth(iso)
}

/** Дата в формате YYYY-MM-DD по локальному времени. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const initials = (firstName: string, lastName: string) =>
  `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
