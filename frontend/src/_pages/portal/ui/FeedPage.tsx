import { portalGlobals } from '@/shared/ui/portal'
import { getRouteApi } from '@/shared/lib/portal-navigation'
import { useChannels, usePosts } from '@/shared/api'
import { ChannelList } from '@/widgets/portal-feed'
import { PostCard, postGridClass } from '@/widgets/portal-feed'
import { Chip, EmptyState, ErrorState, Skeleton } from '@/shared/ui/portal'
import s from './pages.styles'

const route = getRouteApi('/feed')

export function FeedPage() {
  const { channel } = route.useSearch()
  const navigate = route.useNavigate()
  const { data: channels } = useChannels()
  const { data, isPending, isError, refetch } = usePosts(channel)

  const select = (id?: string) => void navigate({ search: { channel: id } })

  return (
    <div className={`${portalGlobals.container} ${s.page}`}>
      <div>
        <h1>Лента</h1>
        <p className={s.subtitle}>Новости компании, команд и сообществ</p>
      </div>
      <div className={s.split}>
        <div>
          <div className={s.filters} role="group" aria-label="Каналы">
            <Chip active={!channel} onClick={() => select(undefined)}>
              Все
            </Chip>
            {channels?.map((item) => (
              <Chip key={item.id} active={channel === item.id} onClick={() => select(item.id)}>
                {item.name}
              </Chip>
            ))}
          </div>
          {isPending && <Skeleton height={360} />}
          {isError && <ErrorState onRetry={() => refetch()} />}
          {data?.length === 0 && <EmptyState>В этом канале пока нет постов</EmptyState>}
          <div className={postGridClass}>
            {data?.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
        </div>
        <div className={s.sticky}>
          <ChannelList />
        </div>
      </div>
    </div>
  )
}
