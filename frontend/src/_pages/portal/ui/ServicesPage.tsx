import { Link } from '@/shared/lib/portal-navigation'
import { useMemo } from 'react'
import { useServices } from '@/shared/api'
import type { Service } from '@/shared/api'
import { container, cx, ErrorState, heading, ServiceIcon, Skeleton } from '@/shared/ui/portal'
import { page, serviceList, subtitle } from './classes'

export function ServiceRow({ service }: { service: Service }) {
  return (
    <Link to="/services/$serviceId" params={{ serviceId: service.id }}
      className="flex items-center gap-3.5 rounded-2xl p-2.5 transition-colors duration-150 ease-out hover:bg-fill hover:duration-200"
    >
      <ServiceIcon icon={service.icon} size={52} />
      <div>
        <div>{service.title}</div>
        <div className="text-13 leading-4.5 text-secondary">{service.description}</div>
      </div>
    </Link>
  )
}

export function ServicesPage() {
  const { data, isPending, isError, refetch } = useServices()

  const groups = useMemo(() => {
    const map = new Map<string, Service[]>()
    for (const service of data ?? []) {
      map.set(service.category, [...(map.get(service.category) ?? []), service])
    }
    return [...map.entries()]
  }, [data])

  return (
    <div className={cx(container, page)}>
      <div>
        <h1 className={heading.h1}>Все сервисы</h1>
        <p className={subtitle}>Документы, офис, развитие и забота — всё, что нужно для работы</p>
      </div>
      <div>
        {isPending && <Skeleton height={400} />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {groups.map(([category, services]) => (
          <section key={category} className="not-first:mt-8" aria-label={category}>
            <h2 className="mb-2 text-21 leading-6.5 font-bold">{category}</h2>
            <div className={serviceList}>
              {services.map((service) => (
                <ServiceRow key={service.id} service={service} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
