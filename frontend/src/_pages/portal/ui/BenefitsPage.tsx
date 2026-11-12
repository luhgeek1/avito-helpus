import { getRouteApi, Link } from '@/shared/lib/portal-navigation'
import { ApiError } from '@/shared/api'
import { useBenefitCategory } from '@/shared/api'
import { buttonClass, container, cx, EmptyState, ErrorState, heading, Illustration, Skeleton } from '@/shared/ui/portal'
import { BackButton } from './BackButton'
import { NotFoundPage } from './NotFoundPage'
import { ServiceRow } from './ServicesPage'
import { besideCornerArt, page, serviceList, subtitle } from './classes'

const route = getRouteApi('/benefits/$categoryId')

const sectionTitle = cx(heading.h2, 'mb-4')

export function BenefitsPage() {
  const { categoryId } = route.useParams()
  const { data, isPending, isError, error, refetch } = useBenefitCategory(categoryId)

  if (isError && error instanceof ApiError && error.status === 404) return <NotFoundPage />

  return (
    <div className={cx(container, page)}>
      <div>
        <BackButton />
        {isPending && <Skeleton height={38} width={320} />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className={heading.h1}>{data.title}</h1>
              <span className="size-1.5 rounded-full bg-tertiary" aria-hidden />
              <span className="text-32 leading-9 font-bold text-green">Плюсы</span>
            </div>
            <p className={subtitle}>{data.description}</p>
          </>
        )}
      </div>

      {data && (
        <>
          <section aria-label="Сервисы">
            <h2 className={sectionTitle}>Сервисы</h2>
            {data.services.length === 0 ? (
              <EmptyState>Сервисы этой категории скоро появятся</EmptyState>
            ) : (
              <div className={serviceList}>
                {data.services.map((service) => (
                  <ServiceRow key={service.id} service={service} />
                ))}
              </div>
            )}
          </section>

          <section aria-label="Узнай больше">
            <h2 className={sectionTitle}>Узнай больше</h2>
            <div className="grid grid-cols-3 gap-4 hub-max-900:grid-cols-2 hub-max-720:grid-cols-1">
              {data.articles.map((article) => (
                <article
                  key={article.id}
                  className="relative flex min-h-44 flex-col items-start gap-1.5 overflow-hidden rounded-3xl bg-fill px-6 pt-5 pb-6"
                >
                  <h3 className={cx(heading.h3, besideCornerArt)}>{article.title}</h3>
                  <p className={cx(besideCornerArt, 'flex-1 text-secondary')}>{article.text}</p>
                  <Link
                    to="/feed/$postId"
                    params={{ postId: article.postId }}
                    className={cx(buttonClass('white', 'm'), 'relative z-1')}
                    aria-label={`Читать: ${article.title}`}
                  >
                    Читать
                  </Link>
                  <Illustration name={article.illustration} size={124} className="absolute -right-1.5 -bottom-3.5 h-auto w-[min(40%,124px)] hub-max-720:-right-2.5 hub-max-720:size-26"
                  />
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
