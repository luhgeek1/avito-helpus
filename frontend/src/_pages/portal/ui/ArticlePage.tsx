import { getRouteApi, Link } from '@/shared/lib/portal-navigation'
import { ChevronRight, Clock, MessageCircle, Sparkles, Tag } from 'lucide-react'
import { useState } from 'react'
import { ApiError } from '@/shared/api'
import { usePost, useToggleSubscription } from '@/shared/api'
import type { Post } from '@/shared/api'
import { subscribersLabel } from '@/widgets/portal-feed'
import { ChannelAvatar, LikeButtonLarge } from '@/widgets/portal-feed'
import { Button, container, Cover, cx, ErrorState, heading, Skeleton } from '@/shared/ui/portal'
import { formatRelative, plural } from '@/shared/lib/portal-format'
import { NotFoundPage } from './NotFoundPage'
import { stickyAside } from './classes'

const route = getRouteApi('/feed/$postId')

const badge = 'inline-flex h-7 items-center gap-1.5 rounded-lg bg-control px-2.5 text-13'

function Summary({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <aside className="mb-6 rounded-2xl bg-purple-soft px-5 py-4" aria-label="Главное из статьи">
      <div className="mb-1.5 flex items-center gap-2 font-bold">
        <Sparkles size={16} className="text-purple" aria-hidden />
        Главное из статьи
      </div>
      <p className={cx(!expanded && 'line-clamp-2')}>{text}</p>
      <button
        type="button"
        className="mt-1 border-0 bg-transparent text-link transition-colors duration-150 ease-in-out hover:text-link-hover"
        onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'Свернуть' : 'Ещё'}
      </button>
    </aside>
  )
}

function Aside({ post }: { post: Post }) {
  const toggle = useToggleSubscription()
  const { channel } = post
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-32 leading-9 font-bold">
          {post.likes} {plural(post.likes, ['отметка', 'отметки', 'отметок'])}
        </div>
        <div className="mt-1 text-secondary">«Нравится» от коллег</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={channel.subscribed ? 'secondary' : 'accent'}
          size="l"
          disabled={toggle.isPending}
          aria-pressed={channel.subscribed}
          onClick={() => toggle.mutate({ id: channel.id, subscribed: !channel.subscribed })}
        >
          {channel.subscribed ? 'Вы подписаны' : 'Подписаться'}
        </Button>
        <LikeButtonLarge post={post} />
      </div>
      <div className="flex justify-between gap-4">
        <div>
          <Link to="/feed" search={{ channel: channel.id }} className="text-21 leading-6.5 font-bold hover:text-link-hover">
            {channel.name}
          </Link>
          <div className="mt-1">{subscribersLabel(channel.subscribers)}</div>
          <div className="text-secondary">{channel.kind}</div>
        </div>
        <ChannelAvatar channel={channel} size={64} />
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={badge}>
          <Tag size={14} aria-hidden />
          {post.tag}
        </span>
        <span className={badge}>
          <MessageCircle size={14} aria-hidden />
          {post.comments} {plural(post.comments, ['комментарий', 'комментария', 'комментариев'])}
        </span>
        <span className={badge}>
          <Clock size={14} aria-hidden />
          {formatRelative(post.publishedAt)}
        </span>
      </div>
    </div>
  )
}

export function ArticlePage() {
  const { postId } = route.useParams()
  const { data: post, isPending, isError, error, refetch } = usePost(postId)

  if (isError && error instanceof ApiError && error.status === 404) return <NotFoundPage />

  return (
    <div className={container}>
      <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-secondary" aria-label="Хлебные крошки">
        <Link to="/" className="hover:text-link-hover">
          Главная
        </Link>
        <ChevronRight size={14} aria-hidden />
        <Link to="/feed" className="hover:text-link-hover">
          Лента
        </Link>
        {post && (
          <>
            <ChevronRight size={14} aria-hidden />
            <Link to="/feed" search={{ channel: post.channel.id }} className="hover:text-link-hover">
              {post.channel.name}
            </Link>
          </>
        )}
      </nav>
      {isPending && <Skeleton className="h-130 rounded-3xl" />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {post && (
        <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-12 hub-max-900:grid-cols-1 hub-max-900:gap-8">
          <article>
            <h1 className={cx(heading.h1, 'mb-5')}>{post.title}</h1>
            <Cover illustration={post.illustration} palette={post.palette} className="mb-6 aspect-video rounded-3xl" />
            {post.summary && <Summary text={post.summary} />}
            <h2 className={cx(heading.h2, 'mb-3')}>Описание</h2>
            <div className="flex flex-col gap-3.5 text-16 leading-6">
              {post.body.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </article>
          <div className={cx(stickyAside, 'flex flex-col gap-4')}>
            <Aside post={post} />
          </div>
        </div>
      )}
    </div>
  )
}
