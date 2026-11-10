import type { Channel, CompanyEvent, Notification, Post } from '../api/schemas'
import { channels, events, notifications, postSeeds } from './data'

/** Изменяемое состояние моков: подписки, лайки, регистрации живут до перезагрузки страницы. */
type Db = {
  channels: Channel[]
  posts: (Omit<Post, 'channel'> & { channelId: string })[]
  events: CompanyEvent[]
  notifications: Notification[]
  feedback: ('like' | 'dislike')[]
}

const clone = <T>(value: T): T => structuredClone(value)

export const db: Db = {
  channels: [],
  posts: [],
  events: [],
  notifications: [],
  feedback: [],
}

export function resetDb(): void {
  db.channels = clone(channels)
  db.posts = clone(postSeeds)
  db.events = clone(events)
  db.notifications = clone(notifications)
  db.feedback = []
}

resetDb()

export function hydratePost(id: string): Post | undefined {
  const seed = db.posts.find((post) => post.id === id)
  if (!seed) return undefined
  const { channelId, ...rest } = seed
  const channel = db.channels.find((item) => item.id === channelId)
  if (!channel) return undefined
  return { ...rest, channel }
}
