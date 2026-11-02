import { createContext, useContext } from 'react'
import type { Habit, Routine } from './api'
import type { Page } from './catalog'
import type { HabitPrefill } from './dialogs'
import type { AppData, ThemeApi } from './hooks'
import type { useReminders } from './hooks'

export interface Ui {
  app: AppData
  theme: ThemeApi
  reminders: ReturnType<typeof useReminders>
  today: string
  search: string
  categoryFilter: number | null
  setCategoryFilter: (id: number | null) => void
  go: (page: Page) => void
  newHabit: (prefill?: HabitPrefill) => void
  editHabit: (habit: Habit) => void
  editHistory: (habit: Habit) => void
  addToRoutine: (habit: Habit) => void
  archiveHabit: (habit: Habit) => void
  deleteHabit: (habit: Habit) => void
  newRoutine: (habit?: Habit) => void
  editRoutine: (routine: Routine) => void
  deleteRoutine: (routine: Routine) => void
  manageCategories: () => void
}

export const UiContext = createContext<Ui | null>(null)

export function useUi() {
  const value = useContext(UiContext)
  if (!value) throw new Error('useUi must be used inside the app shell')
  return value
}
