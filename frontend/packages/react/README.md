# Орби для React

Один компонент: оригинальный Орби и остальные персонажи, гардероб, избранное, перетаскивание,
знакомство, настройки, чат с SSE, Spotlight, источники, подтверждение действий и уведомления.
Стили и шрифты включены и изолированы через Shadow DOM. Tailwind, Next.js и копирование исходников
приложению не нужны. React и React DOM **19.1+** устанавливаются в приложении отдельно.

**Статус:** пакет в `main`, ещё не опубликован в npm.
`@orbi-companion/react` — рабочее имя; владение этим npm scope не подтверждено.
Для рабочего агента нужен сервер Орби. Пакет не содержит сервер, ключ модели и MCP-секреты.

## Установка сейчас

```sh
# В репозитории:
cd frontend
npm ci
npm run sdk:pack
# В другом React-приложении:
npm install /path/to/frontend/packages/react/dist/orbi-companion-react-0.1.0.tgz
```

```tsx
import { OrbiCompanion } from "@orbi-companion/react";

export default function App() {
  return <>
    <main>Ваша платформа</main>
    <OrbiCompanion apiUrl="/api/v1" />
  </>;
}
```

Next.js: импортируйте компонент в постоянный `app/layout.tsx` внутри `body`.
Пакет сохраняет `"use client"`, при SSR не обращается к DOM. Callback-функции передавайте из
своей клиентской оболочки с `"use client"`. Не нужны `transpilePackages` и `ssr: false`.
Для пробы без сервера: `<OrbiCompanion mode="guide" />` — локальная помощь по установке, не LLM.
Примеры: `examples/vite` и `examples/next`; после сборки архива выполните там `npm install`
и `npm run build`. Vite: `npm run dev`; Next.js: `npm start` после сборки.

## API компонента

| Свойство | По умолчанию | Назначение |
|---|---|---|
| `apiUrl` | `/api/v1` | HTTP(S) URL или путь к совместимому API Орби |
| `sessionKey` | не задан | Меняйте при входе, выходе и смене пользователя/компании |
| `getToken` | cookie-режим | `({ forceRefresh, signal }) => token \| null \| Promise` |
| `mode` | `connected` | Рабочий агент или локальное руководство `guide` |
| `autoStartTour` | `false` | Автознакомство, если тур ещё не пройден |
| `onNavigate` | не задан | Переходы `/login`, `/plan`, `/requests` через ваш роутер |
| `portalUrl` | не задан | HTTP(S)-адрес полного портала для этих ссылок |
| `onError` | не задан | Ошибка восстановления сессии или отправка до входа |
| `nonce` | не задан | CSP nonce для элементов style |
| `zIndex` | `1000` | Уровень поверх интерфейса сайта |
| `ref` | не задан | `OrbiHandle`: `openChat`, `ask(text)`, `startOver`, `refreshSession` |

`ask` отправляет после входа; до входа открывает чат и вызывает `onError`, если задан.
Сетевые ошибки ответа показываются в чате. Повторный клик на пузырь закрывает окно с сохранением
переписки. Без навигационного адаптера вход открывается внутри виджета, ссылки к страницам плана
и заявок скрыты; сами карточки доступны в чате. `onNavigate` имеет приоритет при обычном клике.

Один виджет на документ. Повторный экземпляр или неверный `apiUrl` не монтируются: ошибка уходит
в `onError` (без него — в `console.error`), а приложение и уже открытый виджет продолжают работать. При удалении запросы
и SSE отменяются, приватное состояние очищается, стили удаляются. Персонаж, лайки, положение
и пройденное знакомство остаются в localStorage на этом домене.

## Авторизация и сервер

Простой путь: сервер этого репозитория (`docker compose up -d --build` после настройки `.env`),
прокси `/api/v1` на том же домене. В виджете есть вход; синтетическая учётка:
`anya.intern@buddy.test` / `orbi-demo-2026`. JWT в памяти, refresh в httpOnly-cookie, CSRF учтён.
Cookie-режим работает только при API на том же домене: виджет читает CSRF-cookie из `document.cookie`.
Если API на другом домене, передайте `getToken`.

Для SSO ваша серверная часть должна выдать **токен, принимаемый сервером Орби**.
Произвольный JWT другого провайдера требует серверного обмена или проверки.

```tsx
<OrbiCompanion
  apiUrl="https://api.example.test/api/v1"
  sessionKey={`${tenantId}:${userId}:${loginGeneration}`}
  getToken={({ forceRefresh, signal }) =>
    session.getOrbiToken({ forceRefresh, signal })}
  onNavigate={(path) => router.push(path)}
/>
```

В bearer-режиме cookie не отправляются, 401 вызывает один повтор с `forceRefresh: true`.
На сервере задайте точный origin платформы в `CORS_ALLOW_ORIGINS` (через запятую); заголовок
Authorization разрешён. Роли и команды проверяет
сервер. При смене пользователя **обязательно меняйте sessionKey**, включая выход в анонимный режим.
После входа можно вызвать `ref.current.refreshSession()`; getToken должен учитывать AbortSignal.

Прокси пропускает SSE без буферизации и сжатия. Для Next.js: `compress: false` и rewrite `/api/v1`.
Vite-пример использует `ORBI_BACKEND_URL` (по умолчанию тестовый `http://127.0.0.1:8088`);
для обычного локального сервера задайте `http://localhost:8080`.
Для CSP: API в `connect-src`, шрифты `font-src data:`, nonce для `style-src`; перемещение и размеры
используют inline style-атрибуты. Нужны современные браузеры с Shadow DOM и AbortSignal.any
(Chrome 116+, Firefox 124+, Safari 17.4+).

## Контекст и MCP

[Настройка сервера и импорт знаний](https://github.com/luhgeek1/avito-helpus/blob/main/docs/integration/SDK_SERVER.md).
Оператор загружает Markdown с ролями/областью видимости:
`python -m app.cli knowledge-import /path/to/markdown` (`--check` для проверки, `--replace` для обновления).
MCP подключается серверным `CORP_MCP_URL` через контракт `CorpServices`. Произвольный сервер
с другими инструментами требует адаптера. npm-компонент не исполняет произвольные MCP-инструменты.

## Проверка и публикация

В `frontend`: `npm run typecheck`, `npm test`, `npm run coverage`, `npm run check:architecture`,
`npm run build`, `npm run sdk:verify`. Последняя команда собирает архив, устанавливает его
в два независимых временных приложения и собирает React/Vite и Next.js.

Для публичной публикации нужны **npm-аккаунт с 2FA, свой scope, лицензия и версия**.
Сейчас `license: UNLICENSED`: `prepublishOnly` блокирует случайную публикацию.
Выберите лицензию своего кода, добавьте `LICENSE` в пакет и в `files`, обновите `license`.
Лицензии стороннего кода и шрифтов уже включены. Задайте принадлежащее вам имя пакета
(например, `@your-team/orbi-react`) и обновите имя в примерах/инструкции.

```sh
npm login
cd frontend/packages/react
npm publish --access public
```

После публикации любой разработчик сможет выполнить `npm install @your-team/orbi-react`.
Для новых выпусков увеличивайте версию. [Официальная инструкция npm](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).
