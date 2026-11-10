import { getRouteApi } from '@tanstack/react-router'
import { useSearch } from '../api/queries'
import type { Palette, SearchResult } from '../api/schemas'
import { cx, EmptyState, ErrorState, HrefLink, Skeleton } from '../components/ui'
import s from './pages.module.css'

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
    <div className={`container ${s.page}`}>
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
            <span className={cx(s.resultType, `palette-${TYPES[result.type].palette}`)}>{TYPES[result.type].title}</span>
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
