import { useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import s from './pages.module.css'

export function BackButton() {
  const router = useRouter()
  return (
    <button type="button" className={s.back} onClick={() => router.history.back()}>
      <ChevronLeft size={18} />
      Назад
    </button>
  )
}
