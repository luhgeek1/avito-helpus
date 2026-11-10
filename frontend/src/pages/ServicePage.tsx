import { getRouteApi, Link } from '@tanstack/react-router'
import { ApiError } from '../api/client'
import { useService } from '../api/queries'
import { buttonClass, Emoji, ErrorState, Skeleton } from '../components/ui'
import { SERVICE_EMOJI } from '../components/ui/ServiceIcon'
import { BackButton } from './BackButton'
import { NotFoundPage } from './NotFoundPage'
import s from './pages.module.css'

const route = getRouteApi('/services/$serviceId')

/** Страница сервиса. Пока сами сервисы не подключены, показываем карточку-заглушку. */
export function ServicePage() {
  const { serviceId } = route.useParams()
  const { data, isPending, isError, error, refetch } = useService(serviceId)

  if (isError && error instanceof ApiError && error.status === 404) return <NotFoundPage />

  return (
    <div className="container">
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
          <Emoji size={160} className={s.stubArt}>
            {SERVICE_EMOJI[data.icon]}
          </Emoji>
        </section>
      )}
    </div>
  )
}
