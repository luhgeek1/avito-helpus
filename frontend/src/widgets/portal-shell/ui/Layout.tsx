import { portalGlobals } from '@/shared/ui/portal'
import type { ReactNode } from 'react'
import { FeedbackPopup } from './FeedbackPopup'
import { Footer } from './Footer'
import { Header } from './Header'
import s from './layout.styles'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className={`${portalGlobals.root} ${s.shell} isolate bg-white`}>
      <Header />
      <main className={s.main}>
        {children}
      </main>
      <Footer />
      <FeedbackPopup />
    </div>
  )
}
