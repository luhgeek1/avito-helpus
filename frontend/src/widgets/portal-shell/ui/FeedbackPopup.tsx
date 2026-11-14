import { ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { useSendFeedback } from '@/shared/api'
import { usePreferences } from '@/entities/portal'
import { cx, IconButton } from '@/shared/ui/portal'

const popup =
  'fixed bottom-6 left-6 z-40 w-66 animate-hub-layout-drop rounded-3xl bg-white p-5 text-center shadow-pop hub-max-720:bottom-4 hub-max-720:left-4'
const thumb = 'inline-flex size-13 items-center justify-center rounded-2xl border-0 transition-colors duration-150 ease-button'

export function FeedbackPopup() {
  const { feedbackAnswered, feedbackHidden, answerFeedback, hideFeedback } = usePreferences()
  const send = useSendFeedback()

  if (feedbackHidden) return null

  if (feedbackAnswered) {
    return (
      <div className={popup} role="status">
        <IconButton label="Закрыть" className="absolute top-2 right-2" onClick={hideFeedback}>
          <X size={18} />
        </IconButton>
        <p className="mx-5 mb-3.5 font-bold">Спасибо! Учтём ваш ответ</p>
      </div>
    )
  }

  const answer = (value: 'like' | 'dislike') => {
    send.mutate(value)
    answerFeedback()
  }

  return (
    <div className={popup} role="dialog" aria-label="Опрос о портале">
      <IconButton label="Закрыть опрос" className="absolute top-2 right-2" onClick={hideFeedback}>
        <X size={18} />
      </IconButton>
      <p className="mx-5 mb-3.5 font-bold">Что думаешь про новый портал?</p>
      <div className="flex justify-center gap-3">
        <button type="button" className={cx(thumb, 'bg-red-soft text-red-text hover:bg-red-soft-hover')} aria-label="Не нравится" onClick={() => answer('dislike')}>
          <ThumbsDown size={22} />
        </button>
        <button type="button" className={cx(thumb, 'bg-green-soft text-green-text hover:bg-green-soft-hover')} aria-label="Нравится" onClick={() => answer('like')}>
          <ThumbsUp size={22} />
        </button>
      </div>
    </div>
  )
}
