import { getRouteApi, Link } from '@/shared/lib/portal-navigation'
import { ApiError } from '@/shared/api'
import { useService } from '@/shared/api'
import { buttonClass, container, cx, ErrorState, heading, Illustration, SERVICE_ILLUSTRATION, Skeleton } from '@/shared/ui/portal'
import { BackButton } from './BackButton'
import { NotFoundPage } from './NotFoundPage'

const route = getRouteApi('/services/$serviceId')

/** Stub content sits above the illustration. */
const layer = 'relative z-1 max-w-140'

/** Страница сервиса. Пока сами сервисы не подключены, показываем карточку-заглушку. */
export function ServicePage() {
  const { serviceId } = route.useParams()
  const { data, isPending, isError, error, refetch } = useService(serviceId)

  if (isError && error instanceof ApiError && error.status === 404) return <NotFoundPage />

  return (
    <div className={container}>
      <BackButton />
      {isPending && <Skeleton height={300} radius={24} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && (
        <section className="relative flex min-h-75 flex-col items-start gap-3 overflow-hidden rounded-3xl bg-fill p-10 hub-max-720:p-6">
          <h1 className={cx(heading.h1, layer)}>{data.title}</h1>
          <p className={cx(layer, 'text-16 leading-6')}>{data.description}</p>
          <p className={cx(layer, 'text-secondary')}>Сервис скоро подключим к порталу.</p>
          <div className={cx(layer, 'mt-3 flex flex-wrap gap-2')}>
            <Link to="/services" className={buttonClass('primary', 'l')}>
              Все сервисы
            </Link>
            <Link to="/" className={buttonClass('white', 'l')}>
              На главную
            </Link>
          </div>
          <Illustration name={SERVICE_ILLUSTRATION[data.icon]} size={230} className="absolute top-1/2 right-16 -translate-y-1/2 hub-max-900:right-4 hub-max-900:opacity-25"
          />
        </section>
      )}
    </div>
  )
}
