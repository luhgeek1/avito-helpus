import { getRouteApi } from '@/shared/lib/portal-navigation'
import { useSearch } from '@/shared/api'
import type { Palette, SearchResult } from '@/shared/api'
import { container, cx, EmptyState, ErrorState, heading, HrefLink, paletteClass, Skeleton } from '@/shared/ui/portal'
import { page, subtitle } from './classes'

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
    <div className={cx(container, page)}>
      <div>
        <h1 className={heading.h1}>{q ? `Результаты по запросу «${q}»` : 'Поиск'}</h1>
        <p className={subtitle}>
          {q ? (data ? `Найдено: ${data.length}` : 'Ищем…') : 'Введите запрос в строке поиска'}
        </p>
      </div>
      <div className="flex max-w-205 flex-col gap-1">
        {isFetching && !data && <Skeleton height={200} />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data?.length === 0 && <EmptyState>Ничего не нашлось. Попробуйте другой запрос</EmptyState>}
        {data?.map((result) => (
          <HrefLink key={`${result.type}-${result.id}`} href={result.href}
            className="flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors duration-150 ease-out hover:bg-fill hover:duration-200"
          >
            <span
              className={cx(
                'w-24 shrink-0 rounded-lg bg-tone-soft py-1 text-center text-13 leading-4 text-tone-text',
                paletteClass[TYPES[result.type].palette],
              )}
            >
              {TYPES[result.type].title}
            </span>
            <span className="min-w-0">
              <span className="block">{result.title}</span>
              <span className="block truncate text-13 leading-4.5 text-secondary">{result.subtitle}</span>
            </span>
          </HrefLink>
        ))}
      </div>
    </div>
  )
}
