import { portalGlobals } from '@/shared/ui/portal'
import { useState } from 'react'
import type { Palette } from '@/shared/api'
import { cx, Emoji } from '@/shared/ui/portal'
import p from './pages.styles'
import s from './ai.styles'

type Topic = { id: string; title: string; cards: { title: string; text: string; emoji: string; palette: Palette }[] }

const TOPICS: Topic[] = [
  {
    id: 'tech',
    title: 'ИИ-технологии',
    cards: [
      { title: 'Поиск и рекомендации', text: 'Модели помогают находить нужные объявления быстрее', emoji: '🔍', palette: 'blue' },
      { title: 'Модерация', text: 'Автоматическая проверка объявлений до публикации', emoji: '🛡️', palette: 'green' },
      { title: 'Генерация описаний', text: 'Помощь продавцам в составлении текстов', emoji: '✍️', palette: 'purple' },
    ],
  },
  {
    id: 'own',
    title: 'Создать свою модель',
    cards: [
      { title: 'Данные', text: 'Как получить доступ к обезличенным датасетам', emoji: '🗄️', palette: 'blue' },
      { title: 'Обучение', text: 'Вычислительные ресурсы и шаблоны пайплайнов', emoji: '⚙️', palette: 'red' },
      { title: 'Оценка', text: 'Метрики качества и A/B-тесты', emoji: '📊', palette: 'green' },
    ],
  },
  {
    id: 'prod',
    title: 'От идеи до прода',
    cards: [
      { title: 'Идея', text: 'Опишите задачу и ожидаемый эффект', emoji: '💡', palette: 'purple' },
      { title: 'Прототип', text: 'Соберите MVP на готовых инструментах', emoji: '🧪', palette: 'blue' },
      { title: 'Запуск', text: 'Ревью безопасности и вывод в прод', emoji: '🚀', palette: 'green' },
    ],
  },
  {
    id: 'tools',
    title: 'Готовые инструменты',
    cards: [
      { title: 'Подсказки в IDE', text: 'Автодополнение и ревью кода прямо в редакторе', emoji: '💻', palette: 'dark' },
      { title: 'Агенты и MCP', text: 'Настройка агентов с промптами и инструментами', emoji: '🧩', palette: 'purple' },
      { title: 'Распознавание фото', text: 'Определение категории товара по фотографии', emoji: '📷', palette: 'green' },
    ],
  },
  {
    id: 'copilots',
    title: 'AI-копилоты',
    cards: [
      { title: 'Для разработчиков', text: 'Генерация тестов и документации', emoji: '🧑‍💻', palette: 'blue' },
      { title: 'Для аналитиков', text: 'SQL по описанию на естественном языке', emoji: '📈', palette: 'red' },
      { title: 'Для поддержки', text: 'Черновики ответов пользователям', emoji: '💬', palette: 'purple' },
    ],
  },
]

export function AiPage() {
  const [topicId, setTopicId] = useState(TOPICS[0].id)
  const topic = TOPICS.find((item) => item.id === topicId) ?? TOPICS[0]

  return (
    <div className={`${portalGlobals.container} ${p.page}`}>
      <section className={s.hero}>
        <div>
          <h1>Искусственный интеллект в Авито</h1>
          <p className={s.lead}>Создаём продукты и инструменты на основе ИИ — для пользователей и для себя</p>
          <div className={s.nav} role="tablist" aria-label="Разделы">
            {TOPICS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === topicId}
                className={cx(s.navItem, item.id === topicId && s.navActive)}
                onClick={() => setTopicId(item.id)}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
        <div className={s.art} aria-hidden>
          <Emoji size={130} className={cx(s.artItem, 'left-10 top-[30px]')}>
            🤖
          </Emoji>
          <Emoji size={64} className={cx(s.artItem, 'right-0 top-0')}>
            ✨
          </Emoji>
          <Emoji size={72} className={cx(s.artItem, 'right-[10px] bottom-0')}>
            🧠
          </Emoji>
        </div>
      </section>

      <section className={s.section} role="tabpanel" aria-label={topic.title}>
        <h2>{topic.title}</h2>
        <p>Демо-раздел: описания условные и нужны для прототипа</p>
        <div className={s.grid}>
          {topic.cards.map((card) => (
            <article key={card.title} className={cx(s.card, portalGlobals[`palette-${card.palette}`])}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
              <Emoji size={60} className={s.cardArt}>
                {card.emoji}
              </Emoji>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
