import { getRouteApi, Link } from '@/shared/lib/portal-navigation'
import { ApiError } from '@/shared/api'
import { useService } from '@/shared/api'
import { buttonClass, ErrorState, Illustration, portalGlobals, Skeleton } from '@/shared/ui/portal'
import { SERVICE_ILLUSTRATION } from '@/shared/ui/portal'
import { BackButton } from './BackButton'
import { NotFoundPage } from './NotFoundPage'
import s from './pages.styles'

const route = getRouteApi('/services/$serviceId')

/** Страница сервиса. Пока сами сервисы не подключены, показываем карточку-заглушку. */
export function ServicePage() {
  const { serviceId } = route.useParams()
  const { data, isPending, isError, error, refetch } = useService(serviceId)

  if (isError && error instanceof ApiError && error.status === 404) return <NotFoundPage />

  return (
    <div className={portalGlobals.container}>
      <BackButton />
      {isPending && <Skeleton height={300} radius={24} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && (
        <section className={s.stub}>
          <h1>{data.title}</h1>
          <p className={s.stubText}>{data.description}</p>
          <p className={s.stubNote}>Сервис скоро подключим к порталу.</p>
          <div className={s.stubActions}>
            <Link to="/services" className={buttonClass('primary', 'l')}>
              Все сервисы
            </Link>
            <Link to="/" className={buttonClass('white', 'l')}>
              На главную
            </Link>
          </div>
          <Illustration name={SERVICE_ILLUSTRATION[data.icon]} size={230} className={s.stubArt} />
        </section>
      )}
    </div>
  )
}
