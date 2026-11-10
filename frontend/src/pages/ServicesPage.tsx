import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useServices } from '../api/queries'
import type { Service } from '../api/schemas'
import { ErrorState, Skeleton } from '../components/ui'
import { ServiceIcon } from '../components/ui/ServiceIcon'
import s from './pages.module.css'

export function ServiceRow({ service }: { service: Service }) {
  return (
    <Link to="/services/$serviceId" params={{ serviceId: service.id }} className={s.serviceRow}>
      <ServiceIcon icon={service.icon} size={52} />
      <div>
        <div>{service.title}</div>
        <div className={s.serviceRowText}>{service.description}</div>
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
    <div className={`container ${s.page}`}>
      <div>
        <h1>Все сервисы</h1>
        <p className={s.subtitle}>Документы, офис, развитие и забота — всё, что нужно для работы</p>
      </div>
      <div>
        {isPending && <Skeleton height={400} />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {groups.map(([category, services]) => (
          <section key={category} className={s.group} aria-label={category}>
            <h2 className={s.groupTitle}>{category}</h2>
            <div className={s.serviceList}>
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
