import { Link } from '@tanstack/react-router'
import { useChannels, useToggleSubscription } from '../../api/queries'
import type { Channel } from '../../api/schemas'
import { formatNumber, plural } from '../../lib/format'
import { cx, ErrorState, Skeleton } from '../ui'
import { ChannelAvatar } from './PostCard'
import s from './feed.module.css'

export function SubscribeButton({ channel }: { channel: Channel }) {
  const toggle = useToggleSubscription()
  return (
    <button
      type="button"
      className={cx(s.subscribe, channel.subscribed && s.subscribed)}
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
    <aside className={s.channels} aria-label={title}>
      <h3>{title}</h3>
      {isPending && <Skeleton height={180} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data?.map((channel) => (
        <div key={channel.id} className={s.channelRow}>
          <ChannelAvatar channel={channel} />
          <div className={s.channelInfo}>
            <Link to="/feed" search={{ channel: channel.id }} className={s.channelName}>
              {channel.name}
            </Link>
            <div className={s.channelMeta}>{subscribersLabel(channel.subscribers)}</div>
          </div>
          <SubscribeButton channel={channel} />
        </div>
      ))}
    </aside>
  )
}
