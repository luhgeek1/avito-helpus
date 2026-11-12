import { getRouteApi, Link } from '@/shared/lib/portal-navigation'
import { ChevronRight, Clock, MessageCircle, Sparkles, Tag } from 'lucide-react'
import { useState } from 'react'
import { ApiError } from '@/shared/api'
import { usePost, useToggleSubscription } from '@/shared/api'
import type { Post } from '@/shared/api'
import { subscribersLabel } from '@/widgets/portal-feed'
import { ChannelAvatar, LikeButtonLarge } from '@/widgets/portal-feed'
import { Button, Cover, cx, ErrorState, portalGlobals, Skeleton } from '@/shared/ui/portal'
import { formatRelative, plural } from '@/shared/lib/portal-format'
import { NotFoundPage } from './NotFoundPage'
import a from './article.styles'
import s from './pages.styles'

const route = getRouteApi('/feed/$postId')

function Summary({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <aside className={a.summary} aria-label="Главное из статьи">
      <div className={a.summaryHead}>
        <Sparkles size={16} color="var(--c-purple)" aria-hidden />
        Главное из статьи
      </div>
      <p className={cx(!expanded && a.clamped)}>{text}</p>
      <button type="button" className={a.toggle} onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'Свернуть' : 'Ещё'}
      </button>
    </aside>
  )
}

function Aside({ post }: { post: Post }) {
  const toggle = useToggleSubscription()
  const { channel } = post
  return (
    <div className={a.aside}>
      <div>
        <div className={a.stats}>
          {post.likes} {plural(post.likes, ['отметка', 'отметки', 'отметок'])}
        </div>
        <div className={a.statsHint}>«Нравится» от коллег</div>
      </div>
      <div className={a.buttons}>
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
      <div className={a.seller}>
        <div>
          <Link to="/feed" search={{ channel: channel.id }} className={a.sellerName}>
            {channel.name}
          </Link>
          <div className={a.sellerMeta}>{subscribersLabel(channel.subscribers)}</div>
          <div className={a.sellerKind}>{channel.kind}</div>
        </div>
        <ChannelAvatar channel={channel} size={64} />
      </div>
      <div className={a.badges}>
        <span className={a.badge}>
          <Tag size={14} aria-hidden />
          {post.tag}
        </span>
        <span className={a.badge}>
          <MessageCircle size={14} aria-hidden />
          {post.comments} {plural(post.comments, ['комментарий', 'комментария', 'комментариев'])}
        </span>
        <span className={a.badge}>
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
    <div className={portalGlobals.container}>
      <nav className={s.crumbs} aria-label="Хлебные крошки">
        <Link to="/">Главная</Link>
        <ChevronRight size={14} aria-hidden />
        <Link to="/feed">Лента</Link>
        {post && (
          <>
            <ChevronRight size={14} aria-hidden />
            <Link to="/feed" search={{ channel: post.channel.id }}>
              {post.channel.name}
            </Link>
          </>
        )}
      </nav>
      {isPending && <Skeleton height={520} radius={24} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {post && (
        <div className={a.layout}>
          <article>
            <h1 className={a.title}>{post.title}</h1>
            <Cover emoji={post.emoji} palette={post.palette} ratio="16 / 9" emojiSize={160} className={a.cover} />
            {post.summary && <Summary text={post.summary} />}
            <h2 className={a.bodyTitle}>Описание</h2>
            <div className={a.body}>
              {post.body.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </article>
          <div className={s.sticky}>
            <Aside post={post} />
          </div>
        </div>
      )}
    </div>
  )
}
