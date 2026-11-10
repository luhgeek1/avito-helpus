/**
 * Синтетические демо-данные. Все люди, тексты и правила вымышлены и не являются
 * регламентами Авито. Даты считаются относительно текущего момента, чтобы
 * события и дни рождения всегда выглядели актуально.
 */
import type {
  Banner,
  BenefitCategory,
  Birthday,
  CalendarItem,
  Channel,
  CompanyEvent,
  Notification,
  Person,
  PersonShort,
  Post,
  Promo,
  QuickAction,
  Service,
} from '../api/schemas'

export function daysFromNow(days: number, hours = 12, minutes = 0, now = new Date()): string {
  const date = new Date(now)
  date.setDate(date.getDate() + days)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

export function hoursAgo(hours: number, now = new Date()): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString()
}

/* ---------- Люди ---------- */

const short = (p: Person): PersonShort => ({
  id: p.id,
  firstName: p.firstName,
  lastName: p.lastName,
  position: p.position,
  palette: p.palette,
})

const basePerson = {
  middleName: null,
  team: 'Платформа объявлений',
  specialization: 'Backend',
  grade: 'Middle',
  products: ['Публикация объявлений'],
  manager: null,
  mentor: null,
  hrbp: null,
  office: 'Москва, головной офис',
  workMode: 'Гибрид',
  tenure: '3 года',
  organization: 'Авито',
  city: 'Москва',
  followers: 12,
  following: 8,
  achievements: [],
  equipment: [],
  courses: [],
  documents: [],
} satisfies Partial<Person>

const olga: Person = {
  ...basePerson,
  id: 'p-olga',
  firstName: 'Ольга',
  lastName: 'Миронова',
  position: 'Руководитель команды',
  palette: 'purple',
  login: 'o.mironova',
  employeeId: '1032877',
  grade: 'Lead',
  tenure: '5 лет',
  email: 'o.mironova@hub.example',
  birthday: '12 марта',
  followers: 214,
  following: 40,
}

const artem: Person = {
  ...basePerson,
  id: 'p-artem',
  firstName: 'Артём',
  lastName: 'Белов',
  position: 'Senior Backend-разработчик',
  palette: 'blue',
  login: 'a.belov',
  employeeId: '1145020',
  grade: 'Senior',
  tenure: '4 года',
  email: 'a.belov@hub.example',
  birthday: '2 июля',
  followers: 98,
  following: 61,
}

const ksenia: Person = {
  ...basePerson,
  id: 'p-ksenia',
  firstName: 'Ксения',
  lastName: 'Лаврова',
  position: 'HR BP',
  palette: 'red',
  login: 'k.lavrova',
  employeeId: '1098114',
  team: 'HR',
  specialization: 'HR',
  grade: '—',
  products: [],
  email: 'k.lavrova@hub.example',
  birthday: '28 января',
}

export const me: Person = {
  ...basePerson,
  id: 'p-me',
  firstName: 'Даниил',
  lastName: 'Орлов',
  middleName: 'Андреевич',
  position: 'Стажёр-разработчик',
  palette: 'green',
  login: 'd.orlov',
  employeeId: '2048311',
  specialization: 'Стажёры Backend',
  grade: 'Стажёр',
  products: ['Публикация объявлений', 'Модерация'],
  manager: short(olga),
  mentor: short(artem),
  hrbp: short(ksenia),
  tenure: '3 недели',
  organization: 'Авито · Стажёр-разработчик',
  email: 'd.orlov@hub.example',
  birthday: '9 апреля',
  followers: 0,
  following: 3,
  achievements: [
    { id: 'a-1', title: 'Первый коммит', description: 'Изменения попали в main', palette: 'green' },
    { id: 'a-2', title: 'Первое ревью', description: 'Прошёл первое код-ревью', palette: 'purple' },
  ],
  equipment: [
    { id: 'e-1', title: 'Ноутбук 14″', inventoryNumber: 'INV-004211' },
    { id: 'e-2', title: 'Монитор 27″', inventoryNumber: 'INV-007930' },
    { id: 'e-3', title: 'Гарнитура', inventoryNumber: 'INV-010552' },
  ],
  courses: [
    { id: 'c-1', title: 'Введение в архитектуру сервисов', progress: 80, deadline: daysFromNow(5) },
    { id: 'c-2', title: 'Информационная безопасность для новичков', progress: 100, deadline: null },
    { id: 'c-3', title: 'Go: продвинутые практики', progress: 25, deadline: daysFromNow(21) },
  ],
  documents: [
    { id: 'd-1', title: 'Трудовой договор', status: 'signed', date: daysFromNow(-21) },
    { id: 'd-2', title: 'Соглашение о неразглашении', status: 'signed', date: daysFromNow(-21) },
    { id: 'd-3', title: 'Заявление на отгул', status: 'pending', date: daysFromNow(-1) },
  ],
}

const yulia: PersonShort = { id: 'p-yulia', firstName: 'Юлия', lastName: 'Гришина', position: 'Продуктовый дизайнер', palette: 'red' }
const mikhail: PersonShort = { id: 'p-mikhail', firstName: 'Михаил', lastName: 'Зайцев', position: 'QA-инженер', palette: 'blue' }
const andrey: PersonShort = { id: 'p-andrey', firstName: 'Андрей', lastName: 'Котов', position: 'Аналитик данных', palette: 'purple' }

export const people: Person[] = [me, olga, artem, ksenia]

export const birthdays: Birthday[] = [
  { person: yulia, date: daysFromNow(3) },
  { person: mikhail, date: daysFromNow(7) },
  { person: andrey, date: daysFromNow(22) },
]

/* ---------- Главная ---------- */

export const banners: Banner[] = [
  {
    id: 'b-1',
    title: 'Добро пожаловать в Авито',
    text: 'Собрали в одном месте всё для первых недель: доступы, чек-лист новичка и контакты наставника',
    cta: 'Открыть чек-лист',
    href: '/services/onboarding',
    palette: 'blue', emoji: '👋',
  },
  {
    id: 'b-2',
    title: 'Новогодний вечер для своих',
    text: 'Музыка, настолки и подарки. Регистрация открыта до конца месяца',
    cta: 'Записаться',
    href: '/events',
    palette: 'purple', emoji: '🎄',
  },
  {
    id: 'b-3',
    title: 'ИИ в Авито',
    text: 'Как модели помогают в поиске, модерации и ежедневной работе команд',
    cta: 'Узнать больше',
    href: '/ai',
    palette: 'dark', emoji: '🤖',
  },
  {
    id: 'b-4',
    title: 'Хакатон для своих',
    text: 'Двое суток, команды из разных направлений и призы для лучших прототипов',
    cta: 'Читать',
    href: '/feed/post-3',
    palette: 'green', emoji: '🏆',
  },
  {
    id: 'b-5',
    title: 'Пульс-опрос ноября',
    text: 'Пять минут, чтобы рассказать, что помогает и что мешает в работе',
    cta: 'Пройти опрос',
    href: '/services/growth',
    palette: 'red', emoji: '📊',
  },
]

export const quickActions: QuickAction[] = [
  { id: 'qa-events', title: 'События', href: '/events' },
  { id: 'qa-booking', title: 'Забронировать место', href: '/services/booking' },
  { id: 'qa-vacation', title: 'В отпуск', href: '/services/vacation' },
  { id: 'qa-trip', title: 'В командировку', href: '/services/trip' },
  { id: 'qa-tasks', title: 'Мои задачи', href: '/services/onboarding' },
  { id: 'qa-access', title: 'Запросить доступ', href: '/services/access' },
  { id: 'qa-it', title: 'IT-поддержка', href: '/services/it' },
  { id: 'qa-learning', title: 'Моё обучение', href: '/services/learning' },
  { id: 'qa-merch', title: 'Мерч', href: '/services/merch' },
]

export const services: Service[] = [
  { id: 'onboarding', title: 'Чек-лист новичка', description: 'Шаги адаптации, статусы и что сделать дальше', icon: 'checklist', palette: 'green', category: 'Адаптация', featured: true },
  { id: 'booking', title: 'Букинг мест', description: 'Бронь рабочего места и переговорок', icon: 'seat', palette: 'blue', category: 'Офис', featured: true },
  { id: 'learning', title: 'Моё обучение', description: 'Курсы, программы и дедлайны', icon: 'learning', palette: 'purple', category: 'Развитие', featured: true },
  { id: 'growth', title: 'Рост', description: 'Цели, ревью и обратная связь', icon: 'growth', palette: 'red', category: 'Развитие', featured: true },
  { id: 'rotation', title: 'Ротация', description: 'Внутренние вакансии и переходы между командами', icon: 'rotation', palette: 'blue', category: 'Развитие', featured: true },
  { id: 'edo', title: 'Электронные документы', description: 'Подписание документов и справки', icon: 'docs', palette: 'dark', category: 'Документы', featured: true },
  { id: 'achievements', title: 'Ачивки', description: 'Задания, баллы и призы', icon: 'game', palette: 'green', category: 'Сообщество', featured: true },
  { id: 'vacation', title: 'Отпуск и отгулы', description: 'Заявки на отсутствие и остаток дней', icon: 'vacation', palette: 'green', category: 'Документы', featured: true },
  { id: 'trip', title: 'Командировки', description: 'Оформление поездок и отчётов', icon: 'trip', palette: 'blue', category: 'Документы', featured: false },
  { id: 'access', title: 'Доступы', description: 'Запрос доступов к системам и репозиториям', icon: 'access', palette: 'purple', category: 'Адаптация', featured: false },
  { id: 'it', title: 'IT-поддержка', description: 'Заявки на технику и помощь с настройкой', icon: 'it', palette: 'dark', category: 'Офис', featured: true },
  { id: 'merch', title: 'Мерч-шоп', description: 'Одежда и аксессуары с символикой Авито', icon: 'merch', palette: 'red', category: 'Выгода', featured: false },
  { id: 'partners', title: 'Скидки партнёров', description: 'Специальные условия от компаний-партнёров', icon: 'gift', palette: 'green', category: 'Выгода', featured: false },
  { id: 'dms', title: 'ДМС', description: 'Программа медицинского страхования', icon: 'health', palette: 'blue', category: 'Здоровье', featured: false },
  { id: 'psy', title: 'Психологическая помощь', description: 'Конфиденциальные консультации со специалистом', icon: 'psy', palette: 'purple', category: 'Здоровье', featured: false },
  { id: 'sport', title: 'Компенсация спорта', description: 'Фитнес, бассейн и спортивные секции', icon: 'sport', palette: 'red', category: 'Спорт', featured: false },
  { id: 'food', title: 'Питание', description: 'Меню офисной столовой и кофе-поинты', icon: 'food', palette: 'green', category: 'Офис', featured: false },
  { id: 'parking', title: 'Парковка', description: 'Гостевые пропуска и места для велосипедов', icon: 'parking', palette: 'dark', category: 'Офис', featured: false },
  { id: 'library', title: 'Библиотека', description: 'Книги и подписки на цифровые библиотеки', icon: 'library', palette: 'purple', category: 'Развитие', featured: false },
]

export const promos: Promo[] = [
  { id: 'pr-1', title: 'Новый год уже близко', text: 'Собрали все праздничные активности на одной странице', href: '/events', palette: 'green', emoji: '🎁' },
  { id: 'pr-2', title: 'Всё о качестве', text: 'Ключевые инициативы, инструменты и планы на следующий год', href: '/feed/post-2', palette: 'purple', emoji: '💎' },
]

/* ---------- Бенефиты («Плюсы») ---------- */

export const benefitCategories: BenefitCategory[] = [
  { id: 'savings', title: 'Выгода', description: 'Специальные предложения от компании и партнёров', palette: 'green', emoji: '💰', href: '/benefits/savings' },
  { id: 'health', title: 'Здоровье', description: 'ДМС, психологическая помощь и чекапы', palette: 'blue', emoji: '🩺', href: '/benefits/health' },
  { id: 'growth', title: 'Развитие', description: 'Обучение, конференции и ревью', palette: 'purple', emoji: '📚', href: '/benefits/growth' },
  { id: 'sport', title: 'Спорт', description: 'Тренировки, соревнования, победы', palette: 'red', emoji: '⚽️', href: '/benefits/sport' },
  { id: 'office', title: 'Офис', description: 'Бронь мест, питание, пропуск и парковка', palette: 'dark', emoji: '🏢', href: '/benefits/office' },
  { id: 'events', title: 'События', description: 'Наши активности и внутренние продукты', palette: 'blue', emoji: '🎉', href: '/events' },
  { id: 'care', title: 'Забота', description: 'Социальные проекты и поддержка семьи', palette: 'purple', emoji: '🤝', href: '/benefits/care' },
]

/** Категория бенефитов → категории сервисов, которые в ней показываются. */
export const benefitServiceCategories: Record<string, string[]> = {
  savings: ['Выгода', 'Сообщество'],
  health: ['Здоровье'],
  growth: ['Развитие'],
  sport: ['Спорт'],
  office: ['Офис'],
  care: ['Здоровье'],
}

type BenefitArticleSeed = { id: string; title: string; text: string; emoji: string }

export const benefitArticles: Record<string, BenefitArticleSeed[]> = {
  savings: [
    { id: 'friend', title: 'Приведи друга', text: 'Порекомендуй знакомого в команду и получи вознаграждение после испытательного срока', emoji: '🤝' },
    { id: 'partners', title: 'Скидки партнёров', text: 'Специальные условия на технику, путешествия и сервисы', emoji: '🏷️' },
    { id: 'merch', title: 'Мерч со скидкой', text: 'Раз в квартал — скидка на коллекцию мерча', emoji: '👕' },
    { id: 'delivery', title: 'Доставка для своих', text: 'Бесплатная доставка на заказы сотрудников в демо-программе', emoji: '📦' },
    { id: 'tax', title: 'Налоговый вычет', text: 'Как вернуть часть уплаченного НДФЛ за обучение и спорт', emoji: '🧾' },
    { id: 'cards', title: 'Подписки для сотрудников', text: 'Музыка, кино и книги по специальной цене', emoji: '🎧' },
  ],
  health: [
    { id: 'dms', title: 'Программа ДМС', text: 'Что входит в страховку и как записаться к врачу', emoji: '🩺' },
    { id: 'psy', title: 'Психологическая помощь', text: 'До шести бесплатных консультаций в год', emoji: '🧠' },
    { id: 'checkup', title: 'Ежегодный чекап', text: 'Комплексное обследование в клиниках-партнёрах', emoji: '🫀' },
  ],
  growth: [
    { id: 'conf', title: 'Конференции', text: 'Как получить компенсацию участия в профильной конференции', emoji: '🎤' },
    { id: 'english', title: 'Английский', text: 'Групповые занятия с преподавателем два раза в неделю', emoji: '🗣️' },
    { id: 'review', title: 'Ревью компетенций', text: 'Как проходит ревью и как к нему подготовиться', emoji: '📈' },
  ],
  sport: [
    { id: 'fitness', title: 'Компенсация фитнеса', text: 'Частичная компенсация абонемента в любой зал', emoji: '🏋️' },
    { id: 'teams', title: 'Корпоративные команды', text: 'Футбол, бег, волейбол и киберспорт', emoji: '⚽️' },
  ],
  office: [
    { id: 'booking', title: 'Как забронировать место', text: 'Правила гибридного графика и бронирования', emoji: '🪑' },
    { id: 'food', title: 'Питание в офисе', text: 'Меню, кофе-поинты и компенсация обедов', emoji: '🍝' },
  ],
  care: [
    { id: 'volunteer', title: 'Волонтёрство', text: 'Проекты, в которых можно помочь вместе с коллегами', emoji: '🌱' },
    { id: 'family', title: 'Поддержка семьи', text: 'Подарки к рождению ребёнка и детские праздники', emoji: '👶' },
  ],
}

/* ---------- Лента ---------- */

export const channels: Channel[] = [
  { id: 'news', name: 'Новости Авито', kind: 'Компания', subscribers: 48210, subscribed: true, palette: 'blue' },
  { id: 'tech', name: 'Дайджест Тех', kind: 'Инженерия', subscribers: 6350, subscribed: false, palette: 'purple' },
  { id: 'plus', name: 'Плюсы', kind: 'Бенефиты', subscribers: 5109, subscribed: false, palette: 'green' },
  { id: 'interns', name: 'Стажёры Авито', kind: 'Сообщество', subscribers: 1204, subscribed: true, palette: 'red' },
  { id: 'platform', name: 'Команда Платформы', kind: 'Команда', subscribers: 142, subscribed: true, palette: 'dark' },
]

type PostSeed = Omit<Post, 'channel'> & { channelId: string }

const benefitPostSeeds: PostSeed[] = Object.values(benefitArticles)
  .flat()
  .map((article, index) => ({
    id: `benefit-${article.id}`,
    channelId: 'plus',
    tag: 'Бенефиты',
    title: article.title,
    publishedAt: hoursAgo(48 + index * 20),
    palette: (['green', 'blue', 'purple', 'red'] as const)[index % 4],
    coverLabel: article.title,
    emoji: article.emoji,
    lead: article.text,
    summary: null,
    body: [
      article.text + '.',
      'Это демонстрационный материал: условия, суммы и сроки здесь вымышлены и не являются регламентом Авито.',
      'Если остались вопросы, напишите своему HR BP — он подскажет, куда обратиться.',
    ],
    likes: 5 + index * 3,
    liked: false,
    comments: index % 5,
  }))

export const postSeeds: PostSeed[] = [
  {
    id: 'post-1',
    channelId: 'interns',
    tag: 'Стажировка',
    title: 'Первая неделя стажёра: что важно успеть',
    publishedAt: hoursAgo(1),
    palette: 'green', emoji: '🎒',
    coverLabel: 'Чек-лист первой недели',
    lead: 'Собрали советы от стажёров прошлых наборов: доступы, знакомство с командой и первые задачи.',
    summary:
      'В первую неделю стоит получить доступы, познакомиться с наставником и командой, настроить окружение и взять первую небольшую задачу. Вопросы лучше задавать сразу — это нормально и ожидаемо.',
    body: [
      'Первая неделя — время осмотреться. Никто не ждёт от стажёра закрытых задач в первый же день, зато важно быстро разобраться, где что находится.',
      'Начните с доступов: почта, мессенджер, репозитории и трекер задач. Если что-то не выдали автоматически, оставьте заявку в сервисе «Доступы».',
      'Познакомьтесь с наставником и договоритесь о регулярной встрече 1:1. Наставник поможет с первыми задачами и расскажет о договорённостях команды.',
      'Возьмите небольшую задачу — например, исправление в документации или простой баг. Так вы пройдёте весь цикл: ветка, ревью, релиз.',
      'Материал подготовлен для демо-портала и не является регламентом Авито.',
    ],
    likes: 24,
    liked: false,
    comments: 6,
  },
  {
    id: 'post-2',
    channelId: 'news',
    tag: 'Компания',
    title: 'Год качества: что изменилось и что дальше',
    publishedAt: hoursAgo(20),
    palette: 'purple', emoji: '💎',
    coverLabel: 'Год качества',
    lead: 'Подводим промежуточные итоги инициатив по качеству продукта и делимся планами.',
    summary:
      'Команды сократили время реакции на инциденты, внедрили новые инструменты мониторинга и запустили программу обмена опытом. В следующем году фокус — на скорости релизов без потери надёжности.',
    body: [
      'В этом году мы много говорили о качестве: стабильности сервисов, скорости реакции на инциденты и удобстве для пользователей.',
      'Команды договорились о едином подходе к мониторингу и алертам, а дежурства стали прозрачнее.',
      'В следующем году продолжим: больше автоматических проверок, меньше ручной рутины и быстрее релизы.',
      'Цифры и формулировки в этом посте — демонстрационные.',
    ],
    likes: 132,
    liked: false,
    comments: 18,
  },
  {
    id: 'post-3',
    channelId: 'tech',
    tag: 'Достижения',
    title: '«Самый надёжный релиз»: итоги октября',
    publishedAt: hoursAgo(3),
    palette: 'blue', emoji: '🏆',
    coverLabel: 'Итоги октября',
    lead: 'Инженерные команды традиционно подводят итоги месяца и отмечают тех, кто задал высокую планку.',
    summary: 'Отметили команды с самыми стабильными релизами и лучшими постмортемами месяца.',
    body: [
      'Каждый месяц мы отмечаем команды, которые сделали больше всего для надёжности сервисов.',
      'В октябре лидерами стали команды платформы и поиска: ни одного отката релиза и подробные постмортемы.',
      'Поздравляем коллег! Итоги ноября подведём в начале декабря.',
    ],
    likes: 47,
    liked: false,
    comments: 9,
  },
  {
    id: 'post-4',
    channelId: 'tech',
    tag: 'Инженерия',
    title: 'Как мы ускорили поиск по объявлениям',
    publishedAt: hoursAgo(30),
    palette: 'dark', emoji: '🔍',
    coverLabel: 'Поиск',
    lead: 'Рассказываем, как переписали горячий путь поиска и что это дало пользователям.',
    summary: 'Команда вынесла ранжирование в отдельный сервис и добавила кеширование — это сократило задержку ответа.',
    body: [
      'Поиск — один из самых нагруженных сценариев. Мы разобрали его горячий путь и нашли лишние походы в хранилище.',
      'Ранжирование вынесли в отдельный сервис на Go, а частые запросы закешировали в Redis.',
      'Пост демонстрационный: архитектура и цифры придуманы для прототипа.',
    ],
    likes: 88,
    liked: false,
    comments: 14,
  },
  {
    id: 'post-5',
    channelId: 'news',
    tag: 'События',
    title: 'Новогодний вечер: открыта регистрация',
    publishedAt: hoursAgo(50),
    palette: 'red', emoji: '🎄',
    coverLabel: 'Новый год',
    lead: 'Музыка, настолки, подарки и фотозона. Регистрируйтесь заранее — места ограничены.',
    summary: null,
    body: [
      'В этом году отмечаем в офисе и онлайн. Программа — в разделе «События».',
      'Зарегистрироваться можно до конца месяца.',
    ],
    likes: 61,
    liked: false,
    comments: 4,
  },
  {
    id: 'post-6',
    channelId: 'platform',
    tag: 'Команда',
    title: 'Как устроено code review в нашей команде',
    publishedAt: hoursAgo(72),
    palette: 'green', emoji: '👀',
    coverLabel: 'Code review',
    lead: 'Договорённости команды Платформы: сроки ответа, размер изменений и тон комментариев.',
    summary: 'Ревью — в течение рабочего дня, небольшие пулреквесты, доброжелательные комментарии с объяснением «почему».',
    body: [
      'Мы стараемся отвечать на ревью в течение рабочего дня и держим пулреквесты небольшими.',
      'Комментарии пишем доброжелательно и объясняем, почему предлагаем изменение.',
      'Это пример договорённостей для демо, а не регламент Авито.',
    ],
    likes: 15,
    liked: false,
    comments: 2,
  },
  ...benefitPostSeeds,
]

/* ---------- События ---------- */

export const events: CompanyEvent[] = [
  { id: 'ev-1', title: 'ML-академия: задача регрессии', description: 'Открытая лекция для всех, кто хочет разобраться в основах ML', category: 'development', format: 'online', startsAt: daysFromNow(1, 10), place: 'Онлайн', palette: 'dark', emoji: '🧠', featured: true, registered: false, seatsLeft: null },
  { id: 'ev-2', title: 'День ИИ-инструментов', description: 'Команды показывают, как используют ИИ в повседневной работе', category: 'development', format: 'online', startsAt: daysFromNow(1, 12), place: 'Онлайн', palette: 'purple', emoji: '🤖', featured: true, registered: false, seatsLeft: null },
  { id: 'ev-3', title: 'Встреча стажёров ноябрьского набора', description: 'Знакомство, ответы на вопросы и пицца', category: 'office', format: 'offline', startsAt: daysFromNow(2, 18), place: 'Москва, переговорная «Юпитер»', palette: 'green', emoji: '🍕', featured: true, registered: true, seatsLeft: 12 },
  { id: 'ev-4', title: 'Утренняя йога', description: 'Мягкая практика перед рабочим днём', category: 'health', format: 'offline', startsAt: daysFromNow(0, 9), place: 'Москва, спортзал', palette: 'blue', emoji: '🧘', featured: false, registered: false, seatsLeft: 6 },
  { id: 'ev-5', title: 'Корпоративный забег 5 км', description: 'Бежим вместе в парке, есть дистанция для новичков', category: 'sport', format: 'offline', startsAt: daysFromNow(5, 10), place: 'Парк рядом с офисом', palette: 'red', emoji: '🏃', featured: false, registered: false, seatsLeft: 40 },
  { id: 'ev-6', title: 'Как не выгореть в первые месяцы', description: 'Психолог расскажет о балансе работы и отдыха', category: 'health', format: 'online', startsAt: daysFromNow(3, 16), place: 'Онлайн', palette: 'purple', emoji: '🌿', featured: false, registered: false, seatsLeft: null },
  { id: 'ev-7', title: 'Киноклуб: фильм и обсуждение', description: 'Смотрим и обсуждаем фантастику', category: 'culture', format: 'offline', startsAt: daysFromNow(6, 19), place: 'Москва, лаунж', palette: 'dark', emoji: '🎬', featured: false, registered: false, seatsLeft: 25 },
  { id: 'ev-8', title: 'Экскурсия по дата-центру', description: 'Посмотрим, где живут наши сервисы', category: 'office', format: 'offline', startsAt: daysFromNow(12, 11), place: 'Подмосковье', palette: 'blue', emoji: '🖥️', featured: false, registered: false, seatsLeft: 3 },
  { id: 'ev-9', title: 'Турнир по настольному теннису', description: 'Сетка на выбывание, призы победителям', category: 'sport', format: 'offline', startsAt: daysFromNow(20, 18), place: 'Москва, зона отдыха', palette: 'green', emoji: '🏓', featured: false, registered: false, seatsLeft: 16 },
  { id: 'ev-10', title: 'Новогодний вечер для своих', description: 'Музыка, настолки и подарки', category: 'culture', format: 'offline', startsAt: daysFromNow(35, 19), place: 'Москва, головной офис', palette: 'red', emoji: '🎄', featured: false, registered: false, seatsLeft: 120 },
]

/* ---------- Уведомления и календарь ---------- */

export const notifications: Notification[] = [
  { id: 'n-1', title: 'Доступ выдан', text: 'Вам открыт доступ к репозиторию «listings-api»', createdAt: hoursAgo(1), read: false, href: '/services/access' },
  { id: 'n-2', title: 'Встреча 1:1', text: 'Артём Белов пригласил вас на встречу завтра в 11:00', createdAt: hoursAgo(4), read: false, href: '/profile' },
  { id: 'n-3', title: 'Новый курс', text: 'Вам назначен курс «Go: продвинутые практики»', createdAt: hoursAgo(26), read: false, href: '/services/learning' },
  { id: 'n-4', title: 'Документ на подпись', text: 'Заявление на отгул ожидает подписи', createdAt: hoursAgo(30), read: true, href: '/profile' },
]

export function calendarFor(date: string): CalendarItem[] {
  const at = (h: number, m = 0) => `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
  return [
    { id: 'cal-1', title: 'Дейли команды', start: at(10), end: at(10, 15), palette: 'blue' },
    { id: 'cal-2', title: '1:1 с наставником', start: at(11), end: at(11, 30), palette: 'green' },
    { id: 'cal-3', title: 'Ревью пулреквеста', start: at(14), end: at(15), palette: 'purple' },
    { id: 'cal-4', title: 'Лекция: архитектура сервисов', start: at(16), end: at(17), palette: 'red' },
  ]
}
