import { waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderApp, screen } from './render'
import { server } from './setup'
import { usePreferences } from '@/entities/portal'

describe('Главная', () => {
  it('показывает приветствие и все блоки', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: /Привет, Даниил/ })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Добро пожаловать в Авито' })).toBeInTheDocument()
    expect(await screen.findByText('Юлия')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Букинг мест/ })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Новый год уже близко/ })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /^Здоровье ДМС/ })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /Первая неделя стажёра/ })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent('синтетические')
  })

  it('листает карусель стрелками и точками', async () => {
    const { user } = renderApp('/')
    await screen.findByRole('heading', { name: 'Добро пожаловать в Авито' })
    await user.click(screen.getByRole('button', { name: 'Следующий слайд' }))
    expect(screen.getByRole('heading', { name: 'Новогодний вечер для своих' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Предыдущий слайд' }))
    await user.click(screen.getByRole('button', { name: 'Предыдущий слайд' }))
    expect(screen.getByRole('heading', { name: 'Пульс-опрос ноября' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Слайд 3/ }))
    expect(screen.getByRole('heading', { name: 'ИИ в Авито' })).toBeInTheDocument()
  })

  it('настраивает подборку быстрых действий', async () => {
    const { user } = renderApp('/')
    const section = await screen.findByRole('region', { name: 'Быстрые действия' })
    await within(section).findByRole('link', { name: /В отпуск/ })
    await user.click(within(section).getByRole('button', { name: /Настроить подборку/ }))
    const dialog = screen.getByRole('dialog', { name: 'Настроить подборку' })
    await user.click(within(dialog).getByLabelText('В отпуск'))
    await user.click(within(dialog).getByLabelText('Мерч'))
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    expect(within(section).queryByRole('link', { name: /В отпуск/ })).not.toBeInTheDocument()
    expect(within(section).getByRole('link', { name: /Мерч/ })).toBeInTheDocument()
    expect(usePreferences.getState().quickActionIds).toContain('qa-merch')

    await user.click(within(section).getByRole('button', { name: /Настроить подборку/ }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Настроить подборку' })).not.toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: /Настроить подборку/ }))
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('dialog', { name: 'Настроить подборку' })).not.toBeInTheDocument()
  })

  it('показывает ошибку и даёт повторить запрос', async () => {
    server.use(http.get('/api/banners', () => HttpResponse.json({}, { status: 500 }), { once: true }))
    const { user } = renderApp('/')
    const alerts = await screen.findAllByRole('alert')
    await user.click(within(alerts[0]).getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('heading', { name: 'Добро пожаловать в Авито' })).toBeInTheDocument()
  })

  it('подписывается на канал', async () => {
    const { user } = renderApp('/')
    const aside = await screen.findByRole('complementary', { name: 'Будь в курсе' })
    const row = (await within(aside).findByText('Дайджест Тех')).closest('div')!.parentElement!
    await user.click(within(row).getByRole('button', { name: 'Подписаться' }))
    expect(await within(row).findByRole('button', { name: 'Вы подписаны' })).toBeInTheDocument()
    expect(within(row).getByText(/6\s351 подписчик/)).toBeInTheDocument()
  })
})

describe('Шапка и общие элементы', () => {
  it('показывает уведомления и отмечает их прочитанными', async () => {
    const { user } = renderApp('/')
    const bell = await screen.findByRole('button', { name: 'Уведомления: 3 новых' })
    await user.click(bell)
    const panel = screen.getByRole('dialog', { name: 'Уведомления' })
    expect(within(panel).getByText('Доступ выдан')).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Прочитать все' }))
    expect(await screen.findByRole('button', { name: 'Уведомления' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Уведомления' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Уведомления' }))
    await user.click(document.body)
    expect(screen.queryByRole('dialog', { name: 'Уведомления' })).not.toBeInTheDocument()
  })

  it('ищет по порталу', async () => {
    const { user, history } = renderApp('/')
    await user.type(await screen.findByRole('searchbox', { name: 'Поиск по порталу' }), 'Белов{Enter}')
    await waitFor(() => expect(history.location.pathname).toBe('/search'))
    const result = await screen.findByRole('link', { name: /Сотрудник\s*Артём Белов/ })
    await user.click(result)
    expect(await screen.findByText('Белов Артём')).toBeInTheDocument()
  })

  it('сообщает, что ничего не нашлось', async () => {
    renderApp('/search?q=zzzz')
    expect(await screen.findByText(/Ничего не нашлось/)).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Поиск по порталу' })).toHaveValue('zzzz')
  })

  it('без запроса просит ввести поиск', async () => {
    renderApp('/search')
    expect(await screen.findByText('Введите запрос в строке поиска')).toBeInTheDocument()
  })

  it('принимает ответ в опросе о портале', async () => {
    const { user } = renderApp('/')
    const popup = await screen.findByRole('dialog', { name: 'Опрос о портале' })
    await user.click(within(popup).getByRole('button', { name: 'Нравится' }))
    expect(await screen.findByText('Спасибо! Учтём ваш ответ')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByText('Спасибо! Учтём ваш ответ')).not.toBeInTheDocument()
  })

  it('скрывает опрос без ответа', async () => {
    const { user } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Закрыть опрос' }))
    expect(screen.queryByRole('dialog', { name: 'Опрос о портале' })).not.toBeInTheDocument()
    expect(usePreferences.getState().feedbackHidden).toBe(true)
  })

  it('показывает 404 для неизвестной страницы', async () => {
    renderApp('/nowhere')
    expect(await screen.findByRole('heading', { name: 'Такой страницы нет' })).toBeInTheDocument()
  })
})

describe('События', () => {
  it('фильтрует по категории, формату и поиску', async () => {
    const { user, history } = renderApp('/events')
    const upcoming = await screen.findByRole('region', { name: 'Ближайшие события' })
    await within(upcoming).findByText('Утренняя йога')

    await user.click(screen.getByRole('button', { name: /Спорт/ }))
    await waitFor(() => expect(within(upcoming).queryByText('Утренняя йога')).not.toBeInTheDocument())
    expect(within(upcoming).getByText('Корпоративный забег 5 км')).toBeInTheDocument()
    expect(history.location.search).toContain('category=sport')

    await user.click(screen.getByRole('button', { name: /Спорт/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Формат' }), 'online')
    await waitFor(() => expect(within(upcoming).queryByText('Корпоративный забег 5 км')).not.toBeInTheDocument())

    await user.selectOptions(screen.getByRole('combobox', { name: 'Дата' }), 'month')
    await user.type(screen.getByRole('searchbox', { name: 'Найти событие' }), 'нет такого')
    expect(await within(upcoming).findByText(/Ничего не нашли/)).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Город' }), 'Онлайн')
    expect(screen.getByRole('combobox', { name: 'Город' })).toHaveValue('Онлайн')
  })

  it('записывает на событие и отменяет запись', async () => {
    const { user } = renderApp('/events?category=sport')
    const button = await screen.findByRole('button', { name: 'Записаться: Корпоративный забег 5 км' })
    await user.click(button)
    expect(await screen.findByRole('button', { name: 'Отменить запись: Корпоративный забег 5 км' })).toBeInTheDocument()
    expect(screen.getByText('Осталось мест: 39')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Отменить запись: Корпоративный забег 5 км' }))
    expect(await screen.findByText('Осталось мест: 40')).toBeInTheDocument()
  })
})

describe('Лента и статьи', () => {
  it('фильтрует ленту по каналу', async () => {
    const { user } = renderApp('/feed')
    await screen.findByRole('heading', { name: /Год качества/ })
    const filters = screen.getByRole('group', { name: 'Каналы' })
    await user.click(await within(filters).findByRole('button', { name: 'Команда Платформы' }))
    expect(await screen.findByRole('heading', { name: /code review/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Год качества/ })).not.toBeInTheDocument())
    await user.click(within(filters).getByRole('button', { name: 'Все' }))
    expect(await screen.findByRole('heading', { name: /Год качества/ })).toBeInTheDocument()
  })

  it('показывает пустой канал', async () => {
    server.use(http.get('/api/posts', () => HttpResponse.json([])))
    renderApp('/feed?channel=platform')
    expect(await screen.findByText('В этом канале пока нет постов')).toBeInTheDocument()
  })

  it('открывает статью, разворачивает саммари, лайкает и подписывается', async () => {
    const { user } = renderApp('/feed/post-1')
    expect(await screen.findByRole('heading', { level: 1, name: /Первая неделя стажёра/ })).toBeInTheDocument()
    const summary = screen.getByRole('complementary', { name: 'Главное из статьи' })
    await user.click(within(summary).getByRole('button', { name: 'Ещё' }))
    expect(within(summary).getByRole('button', { name: 'Свернуть' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Поставить лайк' }))
    expect(await screen.findByRole('button', { name: 'Убрать лайк' })).toHaveTextContent('25')

    await user.click(screen.getByRole('button', { name: 'Вы подписаны' }))
    expect(await screen.findByRole('button', { name: 'Подписаться' })).toBeInTheDocument()
  })

  it('показывает 404 для несуществующей статьи', async () => {
    renderApp('/feed/unknown')
    expect(await screen.findByRole('heading', { name: 'Такой страницы нет' })).toBeInTheDocument()
  })
})

describe('Плюсы и сервисы', () => {
  it('показывает категорию бенефитов и ведёт в статью', async () => {
    const { user } = renderApp('/benefits/savings')
    expect(await screen.findByRole('heading', { name: 'Выгода' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Мерч-шоп/ })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Читать: Приведи друга' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Приведи друга' })).toBeInTheDocument()
  })

  it('показывает пустую категорию сервисов и 404', async () => {
    server.use(
      http.get('/api/benefits/:id', ({ params }) =>
        params.id === 'care'
          ? HttpResponse.json({ id: 'care', title: 'Забота', description: 'd', palette: 'purple', href: '/benefits/care', illustration: 'heart', services: [], articles: [] })
          : HttpResponse.json({}, { status: 404 }),
      ),
    )
    const first = renderApp('/benefits/care')
    expect(await screen.findByText('Сервисы этой категории скоро появятся')).toBeInTheDocument()
    first.unmount()
    renderApp('/benefits/unknown')
    expect(await screen.findByRole('heading', { name: 'Такой страницы нет' })).toBeInTheDocument()
  })

  it('группирует все сервисы и открывает заглушку сервиса', async () => {
    const { user } = renderApp('/services')
    expect(await screen.findByRole('region', { name: 'Офис' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /IT-поддержка/ }))
    expect(await screen.findByRole('heading', { name: 'IT-поддержка' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Назад' }))
    expect(await screen.findByRole('heading', { name: 'Все сервисы' })).toBeInTheDocument()
  })

  it('показывает 404 для неизвестного сервиса', async () => {
    renderApp('/services/unknown')
    expect(await screen.findByRole('heading', { name: 'Такой страницы нет' })).toBeInTheDocument()
  })
})

describe('Профиль', () => {
  it('показывает свой профиль со всеми вкладками', async () => {
    const { user } = renderApp('/profile')
    expect(await screen.findByText('Орлов Даниил Андреевич')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Белов Артём/ })).toBeInTheDocument()
    expect(screen.getByText('Моё оборудование')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Личные данные' }))
    expect(screen.getByText('d.orlov@hub.example')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Документы' }))
    expect(screen.getByText('Ждёт подписи')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Ревью' }))
    expect(screen.getByText(/Первое ревью/)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Посты' }))
    expect(screen.getByText('Вы пока ничего не публиковали')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Обучение' }))
    expect(screen.getAllByRole('progressbar')).toHaveLength(3)
    expect(screen.getByText(/пройден/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Скопировать логин' }))
  })

  it('листает календарь по дням и неделям', async () => {
    const { user } = renderApp('/profile')
    const calendar = await screen.findByRole('region', { name: 'Календарь' })
    expect(await within(calendar).findByText('Дейли команды')).toBeInTheDocument()
    await user.click(within(calendar).getByRole('button', { name: 'Вперёд' }))
    await user.click(within(calendar).getByRole('button', { name: 'Неделя' }))
    const days = within(calendar).getAllByRole('button', { name: /\d+ [а-я]+/ })
    expect(days).toHaveLength(7)
    await user.click(days[0])
    await user.click(within(calendar).getByRole('button', { name: 'Назад' }))
    expect(await within(calendar).findByText('1:1 с наставником')).toBeInTheDocument()
  })

  it('скрывает приватные вкладки в чужом профиле', async () => {
    const { user } = renderApp('/profile')
    await user.click(await screen.findByRole('link', { name: /Миронова Ольга/ }))
    expect(await screen.findByText('Миронова Ольга')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Личные данные' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'О сотруднике' })).toBeInTheDocument()
    expect(screen.getByText('Достижений пока нет')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Посты' }))
    expect(screen.getByText('Постов пока нет')).toBeInTheDocument()
  })

  it('показывает 404 для неизвестного сотрудника', async () => {
    renderApp('/people/nobody')
    expect(await screen.findByRole('heading', { name: 'Такой страницы нет' })).toBeInTheDocument()
  })
})

describe('Страница ИИ', () => {
  it('переключает разделы', async () => {
    const { user } = renderApp('/ai')
    expect(await screen.findByRole('heading', { name: 'Искусственный интеллект в Авито' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'AI-копилоты' }))
    expect(screen.getByRole('heading', { name: 'Для аналитиков' })).toBeInTheDocument()
  })
})
