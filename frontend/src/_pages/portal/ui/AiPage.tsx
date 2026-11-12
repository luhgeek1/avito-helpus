import { useState } from 'react'
import type { Illustration as IllustrationName, Palette } from '@/shared/api'
import { container, cx, heading, Illustration, paletteClass } from '@/shared/ui/portal'
import { besideCornerArt, page } from './classes'

type Topic = { id: string; title: string; cards: { title: string; text: string; illustration: IllustrationName; palette: Palette }[] }

const TOPICS: Topic[] = [
  {
    id: 'tech',
    title: 'ИИ-технологии',
    cards: [
      { title: 'Поиск и рекомендации', text: 'Модели помогают находить нужные объявления быстрее', illustration: 'magnifier', palette: 'blue' },
      { title: 'Модерация', text: 'Автоматическая проверка объявлений до публикации', illustration: 'shield', palette: 'green' },
      { title: 'Генерация описаний', text: 'Помощь продавцам в составлении текстов', illustration: 'pencil', palette: 'purple' },
    ],
  },
  {
    id: 'own',
    title: 'Создать свою модель',
    cards: [
      { title: 'Данные', text: 'Как получить доступ к обезличенным датасетам', illustration: 'server', palette: 'blue' },
      { title: 'Обучение', text: 'Вычислительные ресурсы и шаблоны пайплайнов', illustration: 'gear', palette: 'red' },
      { title: 'Оценка', text: 'Метрики качества и A/B-тесты', illustration: 'pie-chart', palette: 'green' },
    ],
  },
  {
    id: 'prod',
    title: 'От идеи до прода',
    cards: [
      { title: 'Идея', text: 'Опишите задачу и ожидаемый эффект', illustration: 'bulb', palette: 'purple' },
      { title: 'Прототип', text: 'Соберите MVP на готовых инструментах', illustration: 'flask', palette: 'blue' },
      { title: 'Запуск', text: 'Ревью безопасности и вывод в прод', illustration: 'rocket', palette: 'green' },
    ],
  },
  {
    id: 'tools',
    title: 'Готовые инструменты',
    cards: [
      { title: 'Подсказки в IDE', text: 'Автодополнение и ревью кода прямо в редакторе', illustration: 'laptop', palette: 'dark' },
      { title: 'Агенты и MCP', text: 'Настройка агентов с промптами и инструментами', illustration: 'puzzle', palette: 'purple' },
      { title: 'Распознавание фото', text: 'Определение категории товара по фотографии', illustration: 'camera', palette: 'green' },
    ],
  },
  {
    id: 'copilots',
    title: 'AI-копилоты',
    cards: [
      { title: 'Для разработчиков', text: 'Генерация тестов и документации', illustration: 'document', palette: 'blue' },
      { title: 'Для аналитиков', text: 'SQL по описанию на естественном языке', illustration: 'chart', palette: 'red' },
      { title: 'Для поддержки', text: 'Черновики ответов пользователям', illustration: 'chat-bubbles', palette: 'purple' },
    ],
  },
]

export function AiPage() {
  const [topicId, setTopicId] = useState(TOPICS[0].id)
  const topic = TOPICS.find((item) => item.id === topicId) ?? TOPICS[0]

  return (
    <div className={cx(container, page)}>
      <section className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 overflow-hidden rounded-3xl bg-dark px-10 pt-12 pb-10 text-white hub-max-900:grid-cols-1 hub-max-720:px-5 hub-max-720:py-7">
        <div>
          <h1 className={cx(heading.h1, 'mb-3')}>Искусственный интеллект в Авито</h1>
          <p className="mb-7 max-w-130 text-16 leading-6 text-white/72">Создаём продукты и инструменты на основе ИИ — для пользователей и для себя</p>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Разделы">
            {TOPICS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === topicId}
                // The original item rule outranked the active one: the selected tab differs only by its hover text colour.
                className={cx(
                  'inline-flex h-10 items-center rounded-xl border-0 bg-white/10 px-4 text-white transition-colors duration-150 ease-out hover:bg-white/18 hover:duration-200',
                  item.id === topicId && 'hover:text-primary',
                )}
                onClick={() => setTopicId(item.id)}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
        <div className="relative h-55 w-65 hub-max-900:hidden" aria-hidden>
          <Illustration name="robot" size={160} className="absolute top-2.5 left-0" />
          <Illustration name="sparkles" size={84} className="absolute top-0 right-0" />
          <Illustration name="chip" size={96} className="absolute right-0 bottom-0" />
        </div>
      </section>

      <section role="tabpanel" aria-label={topic.title}>
        <h2 className={cx(heading.h2, 'mb-1')}>{topic.title}</h2>
        <p className="mb-5 text-secondary">Демо-раздел: описания условные и нужны для прототипа</p>
        <div className="grid grid-cols-3 gap-4 hub-max-720:grid-cols-1">
          {topic.cards.map((card) => (
            <article
              key={card.title}
              className={cx(
                'relative flex min-h-42 flex-col gap-1.5 overflow-hidden rounded-3xl bg-tone-soft px-6 py-5',
                paletteClass[card.palette],
              )}
            >
              <h3 className={cx(heading.h3, besideCornerArt)}>{card.title}</h3>
              <p className={cx(besideCornerArt, 'text-secondary')}>{card.text}</p>
              <Illustration name={card.illustration} size={124} className="absolute -right-1.5 -bottom-4 h-auto w-[min(40%,124px)] hub-max-720:-right-2.5 hub-max-720:size-26"
              />
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
