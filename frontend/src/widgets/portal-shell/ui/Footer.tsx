import { Link } from '@/shared/lib/portal-navigation'
import { useState } from 'react'
import { Button, container } from '@/shared/ui/portal'
import { APP_NAME } from './Logo'

const column = 'mb-6 flex flex-col gap-2.5 hub-max-720:mb-0'
const columnLink = 'text-secondary hover:text-link-hover'
const card = 'flex items-center justify-between gap-4 rounded-3xl bg-fill px-5 py-4'

/** Декоративный «QR-код»: настоящий появится, когда будет мобильное приложение. */
function FakeQr() {
  const size = 21
  const cells: { x: number; y: number }[] = []
  let seed = 7
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const inFinder = (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
      if (!inFinder && seed % 3 === 0) cells.push({ x, y })
    }
  }
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="#000" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#000" />
    </g>
  )
  return (
    <svg className="size-19 shrink-0 rounded-xl bg-white p-1.5" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-label="QR-код приложения">
      {cells.map((cell) => (
        <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width={1} height={1} fill="#000" />
      ))}
      {finder(0, 0)}
      {finder(size - 7, 0)}
      {finder(0, size - 7)}
    </svg>
  )
}

export function Footer() {
  const [subscribed, setSubscribed] = useState(false)

  return (
    <footer className="border-t border-divider pt-8 pb-10 hub-max-720:pt-6">
      <div className={container}>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-8 hub-max-900:grid-cols-2 hub-max-720:grid-cols-[minmax(0,max-content)_minmax(0,1fr)] hub-max-720:gap-x-8 hub-max-720:gap-y-6">
          <nav aria-label="Сотрудникам">
            <h4 className="mb-3 text-15 font-bold">Сотрудникам</h4>
            <ul className={column}>
              <li><Link to="/ai" className={columnLink}>Искусственный интеллект</Link></li>
              <li><Link to="/feed/$postId" params={{ postId: 'benefit-friend' }} className={columnLink}>Приведи друга</Link></li>
              <li><Link to="/services/$serviceId" params={{ serviceId: 'sport' }} className={columnLink}>Компенсация спорта</Link></li>
              <li><Link to="/services/$serviceId" params={{ serviceId: 'psy' }} className={columnLink}>Психологическая помощь</Link></li>
              <li><Link to="/services/$serviceId" params={{ serviceId: 'dms' }} className={columnLink}>ДМС</Link></li>
            </ul>
          </nav>

          <nav aria-label="Портал">
            <h4 className="mb-3 text-15 font-bold">Портал</h4>
            <ul className={column}>
              <li><Link to="/services" className={columnLink}>Все сервисы</Link></li>
              <li><Link to="/feed" className={columnLink}>Лента</Link></li>
              <li><Link to="/events" className={columnLink}>События</Link></li>
              <li><Link to="/benefits/$categoryId" params={{ categoryId: 'savings' }} className={columnLink}>Плюсы</Link></li>
            </ul>
          </nav>

          <div className="flex flex-col gap-3 hub-max-900:col-span-full">
            <div className={card}>
              <div>
                <h3 className="mb-0.5 text-15 leading-5 font-bold">{APP_NAME} в смартфоне</h3>
                <p className="text-13 leading-4.5 text-secondary">Отсканируйте QR-код и установите приложение для сотрудников</p>
              </div>
              <FakeQr />
            </div>
            <div className={card}>
              <div>
                <h3 className="mb-0.5 text-15 leading-5 font-bold">Дайджест недели</h3>
                <p className="text-13 leading-4.5 text-secondary">Самое важное из жизни компании — раз в неделю на почту</p>
              </div>
              <Button
                variant={subscribed ? 'secondary' : 'primary'}
                size="m"
                onClick={() => setSubscribed((value) => !value)}
                aria-pressed={subscribed}
                aria-label={subscribed ? 'Отписаться от дайджеста' : 'Подписаться на дайджест'}
              >
                {subscribed ? 'Вы подписаны' : 'Подписаться'}
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-13 leading-4.5 text-secondary">
          Демо-портал для хакатона Hack&amp;Change 2026. Все данные синтетические и не являются регламентами Авито.
        </p>
      </div>
    </footer>
  )
}
