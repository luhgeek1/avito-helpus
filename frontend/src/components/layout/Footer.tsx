import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '../ui'
import { APP_NAME } from './Logo'
import s from './layout.module.css'

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
    <svg className={s.qr} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-label="QR-код приложения">
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
    <footer className={s.footer}>
      <div className="container">
        <div className={s.footerGrid}>
          <nav className={s.footerColumn} aria-label="Сотрудникам">
            <h4>Сотрудникам</h4>
            <ul>
              <li><Link to="/ai">Искусственный интеллект</Link></li>
              <li><Link to="/feed/$postId" params={{ postId: 'benefit-friend' }}>Приведи друга</Link></li>
              <li><Link to="/services/$serviceId" params={{ serviceId: 'sport' }}>Компенсация спорта</Link></li>
              <li><Link to="/services/$serviceId" params={{ serviceId: 'psy' }}>Психологическая помощь</Link></li>
              <li><Link to="/services/$serviceId" params={{ serviceId: 'dms' }}>ДМС</Link></li>
            </ul>
          </nav>

          <nav className={s.footerColumn} aria-label="Портал">
            <h4>Портал</h4>
            <ul>
              <li><Link to="/services">Все сервисы</Link></li>
              <li><Link to="/feed">Лента</Link></li>
              <li><Link to="/events">События</Link></li>
              <li><Link to="/benefits/$categoryId" params={{ categoryId: 'savings' }}>Плюсы</Link></li>
            </ul>
          </nav>

          <div className={s.footerCards}>
            <div className={s.footerCard}>
              <div>
                <h3>{APP_NAME} в смартфоне</h3>
                <p>Отсканируйте QR-код и установите приложение для сотрудников</p>
              </div>
              <FakeQr />
            </div>
            <div className={s.footerCard}>
              <div>
                <h3>Дайджест недели</h3>
                <p>Самое важное из жизни компании — раз в неделю на почту</p>
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
        <p className={s.footerNote}>
          Демо-портал для хакатона Hack&amp;Change 2026. Все данные синтетические и не являются регламентами Авито.
        </p>
      </div>
    </footer>
  )
}
