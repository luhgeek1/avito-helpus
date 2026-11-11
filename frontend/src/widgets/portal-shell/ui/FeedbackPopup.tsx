import { ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { useSendFeedback } from '@/shared/api'
import { usePreferences } from '@/entities/portal'
import { IconButton } from '@/shared/ui/portal'
import s from './layout.styles'

export function FeedbackPopup() {
  const { feedbackAnswered, feedbackHidden, answerFeedback, hideFeedback } = usePreferences()
  const send = useSendFeedback()

  if (feedbackHidden) return null

  if (feedbackAnswered) {
    return (
      <div className={s.feedback} role="status">
        <IconButton label="Закрыть" className={s.feedbackClose} onClick={hideFeedback}>
          <X size={18} />
        </IconButton>
        <p>Спасибо! Учтём ваш ответ</p>
      </div>
    )
  }

  const answer = (value: 'like' | 'dislike') => {
    send.mutate(value)
    answerFeedback()
  }

  return (
    <div className={s.feedback} role="dialog" aria-label="Опрос о портале">
      <IconButton label="Закрыть опрос" className={s.feedbackClose} onClick={hideFeedback}>
        <X size={18} />
      </IconButton>
      <p>Что думаешь про новый портал?</p>
      <div className={s.feedbackButtons}>
        <button type="button" className={`${s.thumb} ${s.thumbDown}`} aria-label="Не нравится" onClick={() => answer('dislike')}>
          <ThumbsDown size={22} />
        </button>
        <button type="button" className={`${s.thumb} ${s.thumbUp}`} aria-label="Нравится" onClick={() => answer('like')}>
          <ThumbsUp size={22} />
        </button>
      </div>
    </div>
  )
}
