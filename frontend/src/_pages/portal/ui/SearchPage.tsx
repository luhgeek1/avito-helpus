import { portalGlobals } from '@/shared/ui/portal'
import { getRouteApi } from '@/shared/lib/portal-navigation'
import { useSearch } from '@/shared/api'
import type { Palette, SearchResult } from '@/shared/api'
import { cx, EmptyState, ErrorState, HrefLink, Skeleton } from '@/shared/ui/portal'
import s from './pages.styles'

const route = getRouteApi('/search')

const TYPES: Record<SearchResult['type'], { title: string; palette: Palette }> = {
  person: { title: 'Сотрудник', palette: 'green' },
  service: { title: 'Сервис', palette: 'blue' },
  event: { title: 'Событие', palette: 'purple' },
  post: { title: 'Пост', palette: 'red' },
}

export function SearchPage() {
  const { q } = route.useSearch()
  const { data, isFetching, isError, refetch } = useSearch(q)

  return (
    <div className={`${portalGlobals.container} ${s.page}`}>
      <div>
        <h1>{q ? `Результаты по запросу «${q}»` : 'Поиск'}</h1>
        <p className={s.subtitle}>
          {q ? (data ? `Найдено: ${data.length}` : 'Ищем…') : 'Введите запрос в строке поиска'}
        </p>
      </div>
      <div className={s.results}>
        {isFetching && !data && <Skeleton height={200} />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data?.length === 0 && <EmptyState>Ничего не нашлось. Попробуйте другой запрос</EmptyState>}
        {data?.map((result) => (
          <HrefLink key={`${result.type}-${result.id}`} href={result.href} className={s.result}>
            <span className={cx(s.resultType, portalGlobals[`palette-${TYPES[result.type].palette}`])}>{TYPES[result.type].title}</span>
            <span className={s.resultBody}>
              <span className={s.resultTitle}>{result.title}</span>
              <span className={s.resultText}>{result.subtitle}</span>
            </span>
          </HrefLink>
        ))}
      </div>
    </div>
  )
}
