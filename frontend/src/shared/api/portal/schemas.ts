import { z } from 'zod'

/** Палитра Авито: используется для обложек, плиток и аватаров. */
export const paletteSchema = z.enum(['blue', 'green', 'red', 'purple', 'dark'])
export type Palette = z.infer<typeof paletteSchema>

export const personShortSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string(),
  palette: paletteSchema,
})
export type PersonShort = z.infer<typeof personShortSchema>

export const achievementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  palette: paletteSchema,
})

export const equipmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  inventoryNumber: z.string(),
})

export const courseSchema = z.object({
  id: z.string(),
  title: z.string(),
  progress: z.number().min(0).max(100),
  deadline: z.string().nullable(),
})

export const documentSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['signed', 'pending']),
  date: z.string(),
})

export const personSchema = personShortSchema.extend({
  middleName: z.string().nullable(),
  login: z.string(),
  employeeId: z.string(),
  team: z.string(),
  specialization: z.string(),
  grade: z.string(),
  products: z.array(z.string()),
  manager: personShortSchema.nullable(),
  mentor: personShortSchema.nullable(),
  hrbp: personShortSchema.nullable(),
  office: z.string(),
  workMode: z.string(),
  tenure: z.string(),
  organization: z.string(),
  email: z.string(),
  birthday: z.string(),
  city: z.string(),
  followers: z.number(),
  following: z.number(),
  achievements: z.array(achievementSchema),
  equipment: z.array(equipmentSchema),
  courses: z.array(courseSchema),
  documents: z.array(documentSchema),
})
export type Person = z.infer<typeof personSchema>

export const bannerSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  cta: z.string(),
  href: z.string(),
  palette: paletteSchema,
  /** Эмодзи-иллюстрация для обложки. */
  emoji: z.string(),
})
export type Banner = z.infer<typeof bannerSchema>

export const quickActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  href: z.string(),
})
export type QuickAction = z.infer<typeof quickActionSchema>

export const birthdaySchema = z.object({
  person: personShortSchema,
  date: z.string(),
})
export type Birthday = z.infer<typeof birthdaySchema>

export const serviceIconSchema = z.enum([
  'game',
  'seat',
  'rotation',
  'growth',
  'learning',
  'docs',
  'vacation',
  'trip',
  'access',
  'it',
  'merch',
  'health',
  'sport',
  'food',
  'parking',
  'gift',
  'psy',
  'library',
  'checklist',
])
export type ServiceIcon = z.infer<typeof serviceIconSchema>

export const serviceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: serviceIconSchema,
  palette: paletteSchema,
  category: z.string(),
  featured: z.boolean(),
})
export type Service = z.infer<typeof serviceSchema>

export const promoSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  href: z.string(),
  palette: paletteSchema,
  /** Эмодзи-иллюстрация для обложки. */
  emoji: z.string(),
})
export type Promo = z.infer<typeof promoSchema>

export const benefitCategorySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  palette: paletteSchema,
  href: z.string(),
  /** Эмодзи-иллюстрация для обложки. */
  emoji: z.string(),
})
export type BenefitCategory = z.infer<typeof benefitCategorySchema>

export const benefitArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  postId: z.string(),
  /** Эмодзи-иллюстрация для обложки. */
  emoji: z.string(),
})

export const benefitCategoryDetailSchema = benefitCategorySchema.extend({
  services: z.array(serviceSchema),
  articles: z.array(benefitArticleSchema),
})
export type BenefitCategoryDetail = z.infer<typeof benefitCategoryDetailSchema>

export const channelSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  subscribers: z.number(),
  subscribed: z.boolean(),
  palette: paletteSchema,
})
export type Channel = z.infer<typeof channelSchema>

export const postSchema = z.object({
  id: z.string(),
  channel: channelSchema,
  tag: z.string(),
  title: z.string(),
  publishedAt: z.string(),
  palette: paletteSchema,
  coverLabel: z.string(),
  lead: z.string(),
  summary: z.string().nullable(),
  body: z.array(z.string()),
  likes: z.number(),
  liked: z.boolean(),
  comments: z.number(),
  /** Эмодзи-иллюстрация для обложки. */
  emoji: z.string(),
})
export type Post = z.infer<typeof postSchema>

export const eventCategorySchema = z.enum(['development', 'health', 'sport', 'office', 'culture'])
export type EventCategory = z.infer<typeof eventCategorySchema>

export const eventFormatSchema = z.enum(['online', 'offline'])
export type EventFormat = z.infer<typeof eventFormatSchema>

export const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: eventCategorySchema,
  format: eventFormatSchema,
  startsAt: z.string(),
  place: z.string(),
  palette: paletteSchema,
  featured: z.boolean(),
  registered: z.boolean(),
  seatsLeft: z.number().nullable(),
  /** Эмодзи-иллюстрация для обложки. */
  emoji: z.string(),
})
export type CompanyEvent = z.infer<typeof eventSchema>

export const notificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  createdAt: z.string(),
  read: z.boolean(),
  href: z.string().nullable(),
})
export type Notification = z.infer<typeof notificationSchema>

export const calendarItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  palette: paletteSchema,
})
export type CalendarItem = z.infer<typeof calendarItemSchema>

export const searchResultSchema = z.object({
  type: z.enum(['person', 'service', 'event', 'post']),
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  href: z.string(),
})
export type SearchResult = z.infer<typeof searchResultSchema>

export const okSchema = z.object({ ok: z.literal(true) })
