/** The installation page and its assistant share this source of truth. */
export const integrationSnippets = {
  start: `cp .env.example .env
docker compose up -d --build`,
  development: `docker compose up -d api worker corp-mock db redis
cd frontend
npm ci
npm run dev`,
  package: `cd frontend
npm ci
npm run sdk:pack
# In your React application:
npm install /path/to/frontend/packages/react/dist/orbi-companion-react-0.1.0.tgz`,
  component: `import { OrbiCompanion } from "@orbi-companion/react";

export default function Platform() {
  return (
    <>
      <main>Your platform</main>
      <OrbiCompanion apiUrl="/api/v1" />
    </>
  );
}`,
  proxy: `import type { NextConfig } from "next";

const config: NextConfig = {
  compress: false,
  async rewrites() {
    return [{
      source: "/api/v1/:path*",
      destination: (process.env.ORBI_BACKEND_URL
        ?? "http://localhost:8080") + "/api/v1/:path*",
    }];
  },
};

export default config;`,
  environment: `# Server environment only
LLM_API_KEY=your-provider-key
LLM_MODEL=gpt-5.4-mini
# LLM_BASE_URL=https://your-gateway.example/v1`,
  diagnostics: `docker compose ps
docker compose logs --tail=100 api worker
curl http://localhost/api/health`,
} as const;

export const integrationSections = [
  { id: "overview", title: "Обзор" },
  { id: "quickstart", title: "Запуск проекта" },
  { id: "react", title: "Встраивание в платформу" },
  { id: "api", title: "Подключение API" },
  { id: "auth", title: "Авторизация и права" },
  { id: "services", title: "Сервисы и знания" },
  { id: "check", title: "Проверка установки" },
] as const;

export type GuideTopicId = "start" | "react" | "api" | "auth" | "llm" | "services" | "appearance" | "check";
export type GuideTopic = {
  id: GuideTopicId;
  title: string;
  section: (typeof integrationSections)[number]["id"];
  terms: string[];
  answer: string;
  code?: { language: string; title: string; value: string };
};

export const guideTopics: readonly GuideTopic[] = [
  {
    id: "start", title: "Запуск проекта", section: "quickstart",
    terms: ["установ", "запуст", "начать", "старт", "docker", "докер", "compose", "скачать", "репозитор", "команд", "локальн"],
    answer: "Открой свежий клон репозитория. Нужен Docker с Compose v2. В корне скопируй .env.example в .env и запусти контейнеры командами ниже. Если .env уже есть, сохрани свои настройки. Затем открой http://localhost — руководство, http://localhost/demo — портал. Ключ LLM для первого запуска не нужен. Для разработки фронтенда отдельно: Node.js 20.9+, npm ci и npm run dev в frontend/; адрес http://localhost:5173.",
    code: { language: "bash", title: "Терминал, корень проекта", value: integrationSnippets.start },
  },
  {
    id: "react", title: "Встраивание в React / Next.js", section: "react",
    terms: ["библиотек", "установить библиотеку", "встро", "интегр", "react", "next", "компонент", "layout", "импорт", "исходник", "npm", "sdk", "пакет", "платформ", "перенес", "перенос", "alias", "алиас", "модул"],
    answer: "Библиотека @orbi-companion/react готова к установке из архива; в публичном npm она ещё не опубликована. В frontend выполни npm ci и npm run sdk:pack, затем установи полученный packages/react/dist/orbi-companion-react-0.1.0.tgz в своё React-приложение через npm install /путь/к/архиву. Нужны React и React DOM 19. Добавь один OrbiCompanion рядом с приложением и передай apiUrl. Tailwind, стили, шрифты, Next.js и копирование исходников не нужны. Виджет сам изолирует оформление, содержит вход, персонажей, гардероб, чат, Spotlight и карточки. В Next.js можно импортировать его прямо в серверный layout; callback-функции передаются из клиентской оболочки. Подробности — frontend/packages/react/README.md.",
    code: { language: "tsx", title: "app/layout.tsx, внутри body", value: integrationSnippets.component },
  },
  {
    id: "api", title: "API и поток ответов", section: "api",
    terms: ["api", "бэкенд", "backend", "прокс", "rewrite", "sse", "стрим", "поток", "буфер", "502", "504", "8080", "ответ не приход", "не отвечает", "связ", "cors"],
    answer: "Клиент обращается к /api/v1 на домене платформы. В Next.js настрой rewrites на ORBI_BACKEND_URL (по умолчанию http://localhost:8080). В Docker этот маршрут обслуживает nginx. API, worker, Postgres и Redis нужны для полного сценария. Ответы чата и уведомления идут через SSE: отключи сжатие в Next.js (compress: false) и буферизацию потока на своём прокси. При 502 проверь, что api запущен и адрес доступен именно из окружения Next.js: localhost в контейнере означает этот контейнер. Swagger — /api/docs на полном Docker-стеке.",
    code: { language: "ts", title: "next.config.ts, объединить со своим конфигом", value: integrationSnippets.proxy },
  },
  {
    id: "auth", title: "Вход, SSO и права", section: "auth",
    terms: ["авториз", "аутентиф", "войти", "вход", "сесси", "cookie", "куки", "csrf", "jwt", "401", "403", "sso", "токен", "парол", "учетк", "учётк", "доступ", "безопас", "рол"],
    answer: "Для рабочего чата нужен вход: npm-виджет содержит свою форму, на стенде доступен /login. Можно передать getToken для токена, принимаемого сервером Орби; при смене пользователя обязательно меняй sessionKey. Демо: anya.intern@buddy.test, пароль orbi-demo-2026. Access JWT хранится в памяти, refresh — в httpOnly-cookie; клиент уже обрабатывает обновление и CSRF. Держи фронтенд и /api/v1 на одном домене. При 401 войди заново и проверь проксирование cookie. Корпоративный SSO пока нужно реализовать в бэкенде: демо-вход не становится SSO от одной настройки. Права и принадлежность к команде проверяет сервер. Заявка отправляется только после подтверждения карточки, с повторной проверкой прав. Помощник по установке на этой странице работает без входа и не выполняет корпоративные действия.",
  },
  {
    id: "llm", title: "Подключение языковой модели", section: "api",
    terms: ["llm", "модел", "ключ", "openai", "провайдер", "офлайн", "offline", "нейросет", "env", "ии", "интеллект"],
    answer: "Без LLM_API_KEY основной Орби работает в офлайн-режиме: инструменты и сценарии доступны, ответы строятся правилами. Для языковой модели укажи LLM_API_KEY в корневом .env; LLM_MODEL задаёт модель диалога, LLM_BASE_URL — совместимый шлюз. После изменения выполни docker compose up -d api worker. Ключ остаётся на сервере; не используй NEXT_PUBLIC_ для секретов. При ошибке провайдера агент переключается на офлайн-режим. После входа текущий режим покажет GET /api/v1/assistant/status; публичный /api/health проверяет доступность сервера. Здесь, в руководстве, я отвечаю локально по разделам установки, без внешней LLM.",
    code: { language: "dotenv", title: ".env, только на сервере", value: integrationSnippets.environment },
  },
  {
    id: "services", title: "Корпоративные сервисы и знания", section: "services",
    terms: ["mcp", "сервис", "знани", "документ", "данны", "confluence", "jira", "адаптер", "outbox", "вебхук", "веб-хук", "webhook", "регламент", "инструкци", "компан"],
    answer: "В прототипе corp-mock имитирует доступы, отсутствия, календарь, IT и мессенджер через MCP. Для реальной компании реализуй адаптеры порта CorpServices в backend/app/infra и подключи свои сервисы. Сохрани outbox, идемпотентность, подтверждение действий и подпись веб-хуков. Документы, роли и команды сейчас синтетические. Загрузи Markdown с метаданными через python -m app.cli knowledge-import /path/to/documents. Сначала --check проверяет файлы без записи, --replace разрешает обновление существующих slug. Укажи роли и область company/team; образец — docs/integration/knowledge-example. В этой версии импортируемые инструкции помечаются тестовыми. Контекст хранится с ACL на сервере, а не в публичном фронтенде. Если инструкции расходятся, Орби показывает оба источника; если ответа нет — предлагает обратиться к наставнику. Автоматического коннектора к реальной Jira или Confluence в прототипе нет.",
  },
  {
    id: "appearance", title: "Внешний вид и управление", section: "react",
    terms: ["пет", "pet", "спутник", "орби", "гардероб", "цвет", "палитр", "стил", "шрифт", "анимац", "лайк", "избран", "скры", "перетаск", "мобил", "телефон", "настройк", "онбординг"],
    answer: "У спутника сохраняются чат, Spotlight по двум Enter, круговое меню, гардероб, перетаскивание, настройки и знакомство. Выбор — buddy-pet, лайки отдельно — buddy-favorites. Не объединяй эти ключи. В npm-пакете стили и шрифты включены и изолированы в Shadow DOM. Виджет монтируется поверх страницы, не зависит от её Tailwind и размера шрифта. autoStartTour включает знакомство, zIndex задаёт уровень поверх интерфейса. Если Орби скрыт, нажми кнопку с миниатюрой пета и подписью «Вернуть на экран» внизу справа. Пауза и prefers-reduced-motion отключают анимации. Основной персонаж — оригинальный orbit.",
  },
  {
    id: "check", title: "Проверка и диагностика", section: "check",
    terms: ["провери", "проверить", "проверк", "ошиб", "не работа", "не запуска", "лог", "диагност", "готов", "smoke", "тест", "порт", "здоров", "health"],
    answer: "Сначала проверь контейнеры и логи командами ниже. Если порт 80 занят, освободи его или измени порт nginx в docker-compose.yml. Открой /demo, войди Аней и попроси доступ к listings-api: должна появиться карточка, после подтверждения — заявка, затем результат и уведомление. Сценарий также проверяет sh deploy/smoke.sh (или python deploy/smoke.py). Для фронтенда в frontend/: npm run typecheck, npm test, npm run check:architecture и npm run build. Если нужна помощь, напиши точный текст ошибки и на каком шаге она возникла; не отправляй пароли или ключи.",
    code: { language: "bash", title: "Терминал, диагностика", value: integrationSnippets.diagnostics },
  },
];
