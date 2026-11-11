import { portalGlobals } from '@/shared/ui/portal'
import { getRouteApi, Link } from '@/shared/lib/portal-navigation'
import { ApiError } from '@/shared/api'
import { useBenefitCategory } from '@/shared/api'
import { buttonClass, Emoji, EmptyState, ErrorState, Skeleton } from '@/shared/ui/portal'
import { BackButton } from './BackButton'
import { NotFoundPage } from './NotFoundPage'
import { ServiceRow } from './ServicesPage'
import s from './pages.styles'

const route = getRouteApi('/benefits/$categoryId')

export function BenefitsPage() {
  const { categoryId } = route.useParams()
  const { data, isPending, isError, error, refetch } = useBenefitCategory(categoryId)

  if (isError && error instanceof ApiError && error.status === 404) return <NotFoundPage />

  return (
    <div className={`${portalGlobals.container} ${s.page}`}>
      <div>
        <BackButton />
        {isPending && <Skeleton height={38} width={320} />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data && (
          <>
            <div className={s.titleRow}>
              <h1>{data.title}</h1>
              <span className={s.titleDot} aria-hidden />
              <span className={s.brand}>Плюсы</span>
            </div>
            <p className={s.subtitle}>{data.description}</p>
          </>
        )}
      </div>

      {data && (
        <>
          <section aria-label="Сервисы">
            <h2 className={s.sectionTitle}>Сервисы</h2>
            {data.services.length === 0 ? (
              <EmptyState>Сервисы этой категории скоро появятся</EmptyState>
            ) : (
              <div className={s.serviceList}>
                {data.services.map((service) => (
                  <ServiceRow key={service.id} service={service} />
                ))}
              </div>
            )}
          </section>

          <section aria-label="Узнай больше">
            <h2 className={s.sectionTitle}>Узнай больше</h2>
            <div className={s.cards}>
              {data.articles.map((article) => (
                <article key={article.id} className={s.infoCard}>
                  <h3>{article.title}</h3>
                  <p>{article.text}</p>
                  <Link
                    to="/feed/$postId"
                    params={{ postId: article.postId }}
                    className={buttonClass('white', 'm')}
                    aria-label={`Читать: ${article.title}`}
                  >
                    Читать
                  </Link>
                  <Emoji size={64} className={s.infoArt}>
                    {article.emoji}
                  </Emoji>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
