import { useRouter } from '@/shared/lib/portal-navigation'
import { ChevronLeft } from 'lucide-react'

export function BackButton() {
  const router = useRouter()
  return (
    <button type="button" className="mb-3 inline-flex items-center gap-0.5 border-0 bg-transparent text-secondary hover:text-link-hover" onClick={() => router.history.back()}>
      <ChevronLeft size={18} />
      Назад
    </button>
  )
}
