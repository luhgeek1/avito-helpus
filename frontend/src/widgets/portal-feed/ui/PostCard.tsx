import { Link } from '@/shared/lib/portal-navigation'
import { Heart, MessageCircle } from 'lucide-react'
import { useToggleLike } from '@/shared/api'
import type { Channel, Post } from '@/shared/api'
import { formatRelative } from '@/shared/lib/portal-format'
import { Button, Cover, cx, paletteClass } from '@/shared/ui/portal'

export function ChannelAvatar({ channel, size = 40 }: { channel: Channel; size?: number }) {
  return (
    <span
      className={cx(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-tone-soft font-bold text-tone-text',
        paletteClass[channel.palette],
      )}
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
      className={cx(
        'inline-flex size-6 shrink-0 items-center justify-center border-0 bg-transparent text-primary transition-colors duration-150 ease-in-out hover:text-red',
        post.liked && 'text-red',
      )}
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
      className="w-full"
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
    <article className="flex min-w-0 flex-col gap-2">
      <Link to="/feed/$postId" params={{ postId: post.id }} className="block rounded-2xl" tabIndex={-1} aria-hidden>
        <Cover illustration={post.illustration} palette={post.palette} badge={post.tag} />
      </Link>
      <div className="flex items-start gap-2">
        <h3 className="line-clamp-2 min-w-0 flex-1 text-15 leading-5 font-normal">
          <Link to="/feed/$postId" params={{ postId: post.id }} className="hover:text-link-hover">
            {post.title}
          </Link>
        </h3>
        <LikeButton post={post} />
      </div>
      <div className="text-16 leading-5 font-bold">{post.channel.name}</div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-13 leading-4.5 text-secondary">
        <span>{formatRelative(post.publishedAt)}</span>
        <span className="inline-flex items-center gap-1" aria-label={`Лайков: ${post.likes}`}>
          <Heart size={13} aria-hidden />
          {post.likes}
        </span>
        <span className="inline-flex items-center gap-1" aria-label={`Комментариев: ${post.comments}`}>
          <MessageCircle size={13} aria-hidden />
          {post.comments}
        </span>
      </div>
    </article>
  )
}

export const postGridClass =
  'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-6 hub-max-720:grid-cols-2 hub-max-720:gap-x-3'
