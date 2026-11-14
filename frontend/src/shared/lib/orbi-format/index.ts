const MOSCOW = "Europe/Moscow";

/** 15 ноября — for plan due dates (plain YYYY-MM-DD, no time zone shift). */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(Date.UTC(year, month - 1, day));
}

/** 15 ноября, 11:04 — moments in Moscow time, as people at Avito read them. */
export function formatMoment(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: MOSCOW }).format(date);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: MOSCOW }).format(date);
}

/** «3 шага», «1 шаг», «5 шагов». */
export function plural(count: number, [one, few, many]: [string, string, string]): string {
  const mod10 = count % 10, mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${count} ${word}`;
}

export function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}

export function initialsOf(fullName: string): string {
  return fullName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
