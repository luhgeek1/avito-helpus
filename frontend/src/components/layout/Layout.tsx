import { Outlet } from '@tanstack/react-router'
import { FeedbackPopup } from './FeedbackPopup'
import { Footer } from './Footer'
import { Header } from './Header'
import s from './layout.module.css'

export function Layout() {
  return (
    <div className={s.shell}>
      <Header />
      <main className={s.main}>
        <Outlet />
      </main>
      <Footer />
      <FeedbackPopup />
    </div>
  )
}
