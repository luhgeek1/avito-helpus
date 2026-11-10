import { Link } from '@tanstack/react-router'
import { Heart, MessageCircle } from 'lucide-react'
import { useToggleLike } from '../../api/queries'
import type { Channel, Post } from '../../api/schemas'
import { formatRelative } from '../../lib/format'
import { Button, Cover, cx } from '../ui'
import s from './feed.module.css'

export function ChannelAvatar({ channel, size = 40 }: { channel: Channel; size?: number }) {
  return (
    <span
      className={cx(s.channelAvatar, `palette-${channel.palette}`)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden
    >
      {channel.name.charAt(0)}
    </span>
  )
}

/** Сердечко у заголовка — как «В избранное» на карточке объявления. */
export function LikeButton({ post }: { post: Post }) {
  const toggle = useToggleLike()
  return (
    <button
      type="button"
      className={cx(s.heart, post.liked && s.liked)}
      aria-pressed={post.liked}
      aria-label={post.liked ? 'Убрать лайк' : 'Поставить лайк'}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate({ id: post.id, liked: !post.liked })}
    >
      <Heart size={22} fill={post.liked ? 'currentColor' : 'none'} strokeWidth={2} />
    </button>
  )
}

/** Большая кнопка лайка со счётчиком для страницы статьи. */
export function LikeButtonLarge({ post }: { post: Post }) {
  const toggle = useToggleLike()
  return (
    <Button
      variant="secondary"
      size="l"
      className={cx(s.likeLarge, post.liked && s.likeLargeActive)}
      aria-pressed={post.liked}
      aria-label={post.liked ? 'Убрать лайк' : 'Поставить лайк'}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate({ id: post.id, liked: !post.liked })}
    >
      <Heart size={20} fill={post.liked ? 'currentColor' : 'none'} />
      {post.likes}
    </Button>
  )
}

export function PostCard({ post }: { post: Post }) {
  return (
    <article className={s.card}>
      <Link to="/feed/$postId" params={{ postId: post.id }} className={s.coverLink} tabIndex={-1} aria-hidden>
        <Cover emoji={post.emoji} palette={post.palette} emojiSize={80} badge={post.tag} />
      </Link>
      <div className={s.titleRow}>
        <h3 className={s.title}>
          <Link to="/feed/$postId" params={{ postId: post.id }}>
            {post.title}
          </Link>
        </h3>
        <LikeButton post={post} />
      </div>
      <div className={s.channelLine}>{post.channel.name}</div>
      <div className={s.meta}>
        <span>{formatRelative(post.publishedAt)}</span>
        <span className={s.metaItem} aria-label={`Лайков: ${post.likes}`}>
          <Heart size={13} aria-hidden />
          {post.likes}
        </span>
        <span className={s.metaItem} aria-label={`Комментариев: ${post.comments}`}>
          <MessageCircle size={13} aria-hidden />
          {post.comments}
        </span>
      </div>
    </article>
  )
}

export const postGridClass = s.grid
