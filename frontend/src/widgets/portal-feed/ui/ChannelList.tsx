import { Link } from '@/shared/lib/portal-navigation'
import { useChannels, useToggleSubscription } from '@/shared/api'
import type { Channel } from '@/shared/api'
import { formatNumber, plural } from '@/shared/lib/portal-format'
import { cx, ErrorState, heading, Skeleton } from '@/shared/ui/portal'
import { ChannelAvatar } from './PostCard'

export function SubscribeButton({ channel }: { channel: Channel }) {
  const toggle = useToggleSubscription()
  return (
    <button
      type="button"
      className={cx(
        'border-0 bg-transparent text-13 text-link transition-colors duration-150 ease-in-out hover:text-link-hover',
        channel.subscribed && 'text-secondary',
      )}
      aria-pressed={channel.subscribed}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate({ id: channel.id, subscribed: !channel.subscribed })}
    >
      {channel.subscribed ? 'Вы подписаны' : 'Подписаться'}
    </button>
  )
}

export const subscribersLabel = (n: number) =>
  `${formatNumber(n)} ${plural(n, ['подписчик', 'подписчика', 'подписчиков'])}`

export function ChannelList({ title = 'Будь в курсе' }: { title?: string }) {
  const { data, isPending, isError, refetch } = useChannels()

  return (
    <aside className="rounded-3xl bg-fill p-5" aria-label={title}>
      <h3 className={cx(heading.h3, 'mb-3')}>{title}</h3>
      {isPending && <Skeleton className="h-45" />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data?.map((channel) => (
        <div key={channel.id} className="flex items-center gap-3 py-2">
          <ChannelAvatar channel={channel} />
          <div className="flex min-w-0 flex-1 flex-col items-start">
            <Link to="/feed" search={{ channel: channel.id }} className="relative bottom-0.5 hover:text-link-hover">
              {channel.name}
            </Link>
            <div className="text-13 leading-4.5 text-secondary">{subscribersLabel(channel.subscribers)}</div>
            <SubscribeButton channel={channel} />
          </div>
        </div>
      ))}
    </aside>
  )
}
