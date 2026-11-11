import { useRouter } from '@/shared/lib/portal-navigation'
import { ChevronLeft } from 'lucide-react'
import s from './pages.styles'

export function BackButton() {
  const router = useRouter()
  return (
    <button type="button" className={s.back} onClick={() => router.history.back()}>
      <ChevronLeft size={18} />
      Назад
    </button>
  )
}
