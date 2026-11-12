import { portalGlobals } from '@/shared/ui/portal'
import type { ReactNode } from 'react'
import { FeedbackPopup } from './FeedbackPopup'
import { Footer } from './Footer'
import { Header } from './Header'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className={`${portalGlobals.root} isolate flex min-h-screen flex-col bg-white`}>
      <Header />
      <main className="flex-1 pt-6 pb-8 hub-max-720:pb-6">
        {children}
      </main>
      <Footer />
      <FeedbackPopup />
    </div>
  )
}
