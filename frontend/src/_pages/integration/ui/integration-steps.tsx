import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";
import { useIntegrationAssistant } from "@/features/integration-assistant";
import { integrationSnippets } from "@/shared/config";
import { cx } from "@/shared/lib/cx";
import { CodeBlock } from "@/shared/ui/code-block";
import { HelpLink, InlineCode, paragraph, Section } from "./integration-ui";

export function IntegrationSteps() {
  const ask = useIntegrationAssistant((state) => state.ask);
  return <>
        <Section id="quickstart" step="01" title="Сначала запустим проект" description="Самый короткий путь — поднять весь стенд в Docker.">
          <p className={paragraph}>Нужны репозиторий проекта и <strong className="font-medium text-ink">Docker с Compose v2</strong>. В свежем клоне выполните команды из корня. Если <InlineCode>.env</InlineCode> уже существует, сохраните свои настройки.</p>
          <CodeBlock code={integrationSnippets.start} language="bash" title="Терминал · корень проекта" />
          <div className="divide-y divide-line rounded-xl border border-line text-13">
            {[{ url: "http://localhost", text: "Это руководство и помощь с установкой" }, { url: "http://localhost/demo", text: "Портал «Хаб» с рабочим спутником" }, { url: "http://localhost/api/docs", text: "Swagger UI бэкенда" }].map(({ url, text }) => <div key={url} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4"><code className="break-all font-mono text-12 text-[#6a55a4]">{url}</code><span className="text-[#72798a]">{text}</span></div>)}
          </div>
          <p className="rounded-xl bg-[#f3f7f5] px-4 py-3 text-12 leading-6 text-[#527260]">Ключ языковой модели для первого запуска не нужен. Без него Орби работает в офлайн-режиме: сценарии и инструменты остаются доступны.</p>
          <details className="rounded-xl border border-line px-4">
            <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 text-13 font-medium">Хочу разрабатывать фронтенд отдельно<ChevronDown size={16} aria-hidden /></summary>
            <p className={cx(paragraph, "mb-4")}>Нужен Node.js 20.9+. Бэкенд запустится в Docker, Next.js — на <InlineCode>http://localhost:5173</InlineCode>.</p>
            <CodeBlock code={integrationSnippets.development} language="bash" title="Терминал · разработка" className="mb-4" />
          </details>
        </Section>

        <Section id="react" step="02" title="Добавьте Орби в свой интерфейс" description="Готовая клиентская оболочка для Next.js App Router.">
          <p className={paragraph}>Спутник поставляется в исходниках: отдельный npm-пакет пока не опубликован. <InlineCode>OrbiCompanion</InlineCode> уже объединяет провайдеры, сессию, живые уведомления и виджет. Подключите его один раз в постоянном layout.</p>
          <ol className="space-y-4 text-13 leading-7 text-[#646b7a]">
            <li className="flex gap-3"><span className="font-mono text-[#9b91a9]">1.</span><span>Перенесите <InlineCode>frontend/src</InlineCode>, зависимости из <InlineCode>package.json</InlineCode> и сохраните alias <InlineCode>@/* → ./src/*</InlineCode>.</span></li>
            <li className="flex gap-3"><span className="font-mono text-[#9b91a9]">2.</span><span>Подключите Tailwind с темой <InlineCode>tailwind.config.ts</InlineCode>, <InlineCode>app/globals.css</InlineCode>, PostCSS и локальные шрифты из <InlineCode>public/fonts</InlineCode> и <InlineCode>app/layout.tsx</InlineCode>.</span></li>
            <li className="flex gap-3"><span className="font-mono text-[#9b91a9]">3.</span><span>Оберните содержимое <InlineCode>body</InlineCode> компонентом ниже. Сохраните маршруты <InlineCode>/login</InlineCode>, <InlineCode>/pets</InlineCode>, <InlineCode>/plan</InlineCode>, <InlineCode>/requests</InlineCode>, <InlineCode>/questions</InlineCode> и <InlineCode>/mentor</InlineCode> либо адаптируйте ссылки под свою платформу.</span></li>
          </ol>
          <CodeBlock code={integrationSnippets.component} language="tsx" title="app/layout.tsx · внутри body" />
          <p className={paragraph}>Спутнику нужен layout без <InlineCode>transform</InlineCode> и обрезки <InlineCode>overflow</InlineCode>. Для другого React-роутера замените адаптеры <InlineCode>next/link</InlineCode> и <InlineCode>next/navigation</InlineCode>. Самостоятельный script-виджет для произвольного сайта пока не поставляется.</p>
          <HelpLink question="Как перенести Орби в свой Next.js проект?">Разобрать встраивание с Орби</HelpLink>
        </Section>

        <Section id="api" step="03" title="Соедините спутника с API" description="Один домен для интерфейса, сессии и потока ответов.">
          <p className={paragraph}>Клиент уже использует <InlineCode>/api/v1</InlineCode>. Направьте этот префикс на FastAPI. В Docker это делает nginx, при локальной разработке — Next.js. Адрес API задаётся серверной переменной <InlineCode>ORBI_BACKEND_URL</InlineCode>.</p>
          <CodeBlock code={integrationSnippets.proxy} language="ts" title="next.config.ts · объединить со своим конфигом" />
          <p className={paragraph}>Чат и уведомления приходят через SSE. Оставьте <InlineCode>compress: false</InlineCode> и отключите буферизацию на своём прокси, чтобы ответ появлялся по мере генерации. Для полной работы нужны API, worker, Postgres и Redis.</p>
          <details className="rounded-xl border border-line px-4">
            <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 text-13 font-medium">Подключить языковую модель<ChevronDown size={16} aria-hidden /></summary>
            <p className={cx(paragraph, "mb-4")}>Добавьте настройки в корневой <InlineCode>.env</InlineCode> и выполните <InlineCode>docker compose up -d api worker</InlineCode>. Ключ хранится только на сервере. Поддерживается OpenAI-совместимый шлюз.</p>
            <CodeBlock code={integrationSnippets.environment} language="dotenv" title=".env · только на сервере" className="mb-4" />
          </details>
        </Section>

        <Section id="auth" step="04" title="Подключите вход и права" description="Демо-учётки для стенда, корпоративный SSO — для вашей компании.">
          <p className={paragraph}>На стенде войдите через <Link href="/login" className="font-medium text-[#6a55a4] underline underline-offset-4">страницу входа</Link>. Для основного сценария выберите Аню: <InlineCode>anya.intern@buddy.test</InlineCode>, пароль <InlineCode>orbi-demo-2026</InlineCode>. Все учётки тестовые.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="border-l-2 border-[#d9cee9] pl-4"><h3 className="text-14 font-medium">Сессия уже готова</h3><p className="mt-2 text-13 leading-6 text-[#737988]">JWT в памяти, refresh в httpOnly-cookie, обновление токена и CSRF в API-клиенте. Держите API на домене платформы.</p></div>
            <div className="border-l-2 border-[#d9cee9] pl-4"><h3 className="text-14 font-medium">Права остаются на сервере</h3><p className="mt-2 text-13 leading-6 text-[#737988]">Роль, команда и доступ к документам проверяются бэкендом. Каждое действие с последствиями требует подтверждения карточки.</p></div>
          </div>
          <p className={paragraph}>Для корпоративного запуска реализуйте обмен SSO-сессии на сессию Орби и загрузку оргструктуры в бэкенде. Это отдельный шаг интеграции. Демо-вход по паролю показывает готовый сценарий авторизации.</p>
        </Section>

        <Section id="services" step="05" title="Дайте Орби контекст компании" description="Ваши документы, команды и адаптеры корпоративных сервисов.">
          <div className="overflow-hidden rounded-xl border border-line text-13">
            <div className="grid grid-cols-2 gap-4 bg-canvas px-4 py-3 font-medium"><span>На стенде</span><span>В вашей платформе</span></div>
            {[ ["Синтетические документы и команды", "Свои знания с ACL и оргструктура"], ["corp-mock по MCP", "Адаптеры к доступам, IT и отсутствиям"], ["Демо-пользователи", "Корпоративный SSO"], ["OpenAI / офлайн-режим", "Ваша модель или совместимый шлюз"] ].map(([before, after]) => <div key={before} className="grid grid-cols-2 gap-4 border-t border-line px-4 py-3 leading-6"><span className="text-[#7a8090]">{before}</span><span>{after}</span></div>)}
          </div>
          <p className={paragraph}>Подключайте сервисы через порт <InlineCode>CorpServices</InlineCode> и адаптеры в <InlineCode>backend/app/infra</InlineCode>. Сохраните outbox, идемпотентность и проверку подписи веб-хуков. Документы загружайте через серверный слой знаний с правами доступа.</p>
          <p className={paragraph}>Автоматических коннекторов к реальной Jira и Confluence пока нет. Текущие данные и инструкции — тестовые, они не являются регламентами Авито.</p>
          <HelpLink question="Как подключить свои корпоративные сервисы и документы?">Что заменить при внедрении</HelpLink>
        </Section>

        <Section id="check" step="06" title="Проверьте полный путь" description="От первого сообщения до результата в корпоративном сервисе.">
          <ul className="space-y-3 text-13 leading-6 text-[#646b7a]">
            {["Откройте демо и войдите под тестовой учёткой Ани.", "Попросите доступ к listings-api: Орби должен показать карточку.", "Подтвердите её: появится заявка, затем результат и уведомление.", "Проверьте чат и меню на телефоне, перетаскивание и паузу анимаций."].map((text) => <li key={text} className="flex gap-3"><Check size={16} className="mt-1 shrink-0 text-[#7c9c89]" aria-hidden />{text}</li>)}
          </ul>
          <CodeBlock code={integrationSnippets.diagnostics} language="bash" title="Терминал · диагностика" />
          <p className={paragraph}>Сквозная проверка: <InlineCode>sh deploy/smoke.sh</InlineCode> или <InlineCode>python deploy/smoke.py</InlineCode>. Если что-то не так, спросите Орби и укажите текст ошибки.</p>
          <div className="divide-y divide-line border-y border-line">
            {[{ title: "API возвращает 502", question: "API возвращает 502 — что проверить?" }, { title: "Чат просит войти / ошибка 401", question: "Чат возвращает 401. Как настроить авторизацию?" }, { title: "Ответ появляется только целиком", question: "SSE буферизуется, ответ приходит целиком. Что делать?" }].map(({ title, question }) => <button type="button" key={title} onClick={() => ask(question)}
              className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left text-13 hover:text-[#6a55a4]">{title}<ArrowUpRight size={16} className="text-[#a299b1]" aria-hidden /></button>)}
          </div>
        </Section>
  </>;
}
