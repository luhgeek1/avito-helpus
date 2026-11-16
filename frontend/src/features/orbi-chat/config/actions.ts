export type ActionId = "vacation" | "day-off" | "sick" | "access" | "it" | "mentor" | "team";
export type ActionField = { key: string; label: string; type: "date" | "text" | "textarea"; placeholder?: string };
type ActionDefinition = { id: ActionId; title: string; detail: string; fields: ActionField[]; hint: string };
const dates: ActionField[] = [{ key: "start", label: "С", type: "date" }, { key: "end", label: "По", type: "date" }];
const confirmation = "Сначала подготовлю карточку. Отправлю только после подтверждения.";

export const WORKPLACE_ACTIONS: ActionDefinition[] = [
  { id: "vacation", title: "Отпуск", detail: "Даты, остаток и встречи", fields: dates, hint: confirmation },
  { id: "day-off", title: "Отгул", detail: "Один или несколько дней", fields: dates, hint: confirmation },
  { id: "sick", title: "Больничный", detail: "Уведомить об отсутствии", fields: dates,
    hint: "Уведомление для HR, без списания отпуска. Медицинский документ оформляется отдельно. Диагноз и файлы не нужны." },
  { id: "access", title: "Получить доступ", detail: "К рабочему инструменту", fields: [
    { key: "details", label: "Система или ресурс", type: "text", placeholder: "Например, Grafana или listings-api" }], hint: confirmation },
  { id: "it", title: "Помощь IT", detail: "Техника, VPN, программы", fields: [
    { key: "details", label: "Что не работает?", type: "textarea", placeholder: "Что случилось и как это мешает работе? Без паролей и токенов." }], hint: confirmation },
  { id: "mentor", title: "Помощь наставника", detail: "Вопрос или затруднение", fields: [
    { key: "details", label: "С чем нужна помощь?", type: "textarea", placeholder: "Опиши вопрос и что уже пробовал" }], hint: confirmation },
  { id: "team", title: "Сообщить команде", detail: "В рабочий канал", fields: [
    { key: "details", label: "Текст сообщения", type: "textarea", placeholder: "Например: завтра буду на обучении с 10 до 12" }],
    hint: "Сообщение увидит вся команда. Перед отправкой покажу текст и канал." },
];

export function actionPrompt(id: ActionId, values: Record<string, string>): string {
  const day = (value: string) => value.split("-").reverse().join(".");
  const details = values.details?.trim() ?? "";
  switch (id) {
    case "vacation": case "day-off": case "sick": {
      const kind = { vacation: "отпуск", "day-off": "отгул", sick: "уведомление о больничном" }[id];
      return `Оформи ${kind} с ${day(values.start)} по ${day(values.end)}`;
    }
    case "access": return `Нужен доступ к ${details}`;
    case "it": return `Создай обращение в IT: ${details}`;
    case "mentor": return `Передай наставнику вопрос: ${details}`;
    case "team": return `Напиши команде: ${details}`;
  }
}

export function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
