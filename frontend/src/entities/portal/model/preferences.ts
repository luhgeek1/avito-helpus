import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/** Быстрые действия по умолчанию — id из ответа `GET /quick-actions`. */
export const DEFAULT_QUICK_ACTIONS = ['qa-events', 'qa-booking', 'qa-vacation', 'qa-trip', 'qa-tasks', 'qa-access']

type PreferencesState = {
  quickActionIds: string[]
  feedbackAnswered: boolean
  feedbackHidden: boolean
  setQuickActions: (ids: string[]) => void
  answerFeedback: () => void
  hideFeedback: () => void
}

/** Настройки пользователя, которые живут в браузере: подборка быстрых действий, опрос. */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      quickActionIds: DEFAULT_QUICK_ACTIONS,
      feedbackAnswered: false,
      feedbackHidden: false,
      setQuickActions: (ids) => set({ quickActionIds: ids }),
      answerFeedback: () => set({ feedbackAnswered: true }),
      hideFeedback: () => set({ feedbackHidden: true }),
    }),
    {
      name: 'hub-preferences',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
