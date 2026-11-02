export type Tone = 'violet' | 'rose' | 'amber' | 'emerald' | 'sky' | 'coral' | 'teal' | 'slate'

export interface Profile {
  name: string
  timeZone: string
}

export interface Category {
  id: number
  name: string
  color: Tone
  habitCount: number
}

export type TrackType = 'YES_NO' | 'MEASURABLE'
export type RepeatKind = 'DAILY' | 'HABIT_DAYS' | 'CUSTOM_DAYS' | 'EVERY_N_DAYS'

export interface Reminder {
  id?: number
  time: string
  repeat: RepeatKind
  days: string[]
  intervalDays: number | null
  message: string | null
  enabled: boolean
}

export interface Habit {
  id: number
  name: string
  categoryId: number | null
  categoryName: string | null
  categoryColor: Tone | null
  icon: string
  goal: string
  trackType: TrackType
  targetValue: number | null
  unit: string | null
  weeklyTarget: number
  scheduledDays: string[]
  archived: boolean
  startDate: string
  streak: number
  dueOnDate: boolean
  completed: boolean
  value: number | null
  weekCompleted: number
  reminders: Reminder[]
}

export interface HabitInput {
  name: string
  categoryId: number | null
  icon: string
  goal: string
  scheduledDays: string[]
  archived?: boolean
  trackType: TrackType
  targetValue: number | null
  unit: string | null
  reminders: Reminder[]
}

/** Everything needed to resend a habit unchanged (used for archive and other partial edits). */
export const habitToInput = (habit: Habit): HabitInput => ({
  name: habit.name, categoryId: habit.categoryId, icon: habit.icon, goal: habit.goal,
  scheduledDays: habit.scheduledDays, archived: habit.archived, trackType: habit.trackType,
  targetValue: habit.targetValue, unit: habit.unit, reminders: habit.reminders,
})

export interface CheckInBody {
  date: string
  completed?: boolean
  value?: number
}

export interface CheckInEntry {
  date: string
  completed: boolean
  value: number | null
}

export interface ReminderDue {
  habitId: number
  habitName: string
  icon: string
  categoryColor: Tone
  time: string
  message: string | null
  completed: boolean
}

export interface RoutineStep {
  id: number
  name: string
  completed: boolean
  habitId: number | null
  habitIcon: string | null
  habitColor: Tone | null
}

export interface Routine {
  id: number
  name: string
  scheduledTime: string | null
  color: Tone
  steps: RoutineStep[]
}

export interface RoutineInput {
  name: string
  scheduledTime: string | null
  color: Tone
  steps: { id?: number; name?: string; habitId?: number | null }[]
}

export interface DayStat {
  date: string
  total: number
  completed: number
}

export interface HabitInsight {
  id: number
  name: string
  icon: string
  categoryColor: Tone
  streak: number
  longestStreak: number
  rate30: number
  last7: ('done' | 'missed' | 'pending' | 'off')[]
}

export interface Insights {
  weekCheckIns: number
  lastWeekCheckIns: number
  bestStreak: number
  longestStreak: number
  completionRate30: number
  activeHabits: number
  week: DayStat[]
  habits: HabitInsight[]
  categories: { name: string; color: Tone; completed: number }[]
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Cannot reach the server. Check that the API is running on port 8080.')
  }

  if (response.status === 204) return undefined as T
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error((data && typeof data.message === 'string' && data.message) || 'Something went wrong. Please try again.')
  }
  return data as T
}

export const api = {
  profile: () => request<Profile>('GET', '/profile'),
  updateProfile: (profile: Profile) => request<Profile>('PUT', '/profile', profile),

  habits: (date: string) => request<Habit[]>('GET', `/habits?date=${date}`),
  createHabit: (input: HabitInput) => request<Habit>('POST', '/habits', input),
  updateHabit: (id: number, input: HabitInput) => request<Habit>('PUT', `/habits/${id}`, input),
  deleteHabit: (id: number) => request<void>('DELETE', `/habits/${id}`),
  checkIn: (id: number, body: CheckInBody) => request<void>('POST', `/habits/${id}/check-ins`, body),
  checkIns: (id: number, from: string, to: string) => request<CheckInEntry[]>('GET', `/habits/${id}/check-ins?from=${from}&to=${to}`),
  deleteCheckIn: (id: number, date: string) => request<void>('DELETE', `/habits/${id}/check-ins/${date}`),
  reminders: (date: string) => request<ReminderDue[]>('GET', `/reminders?date=${date}`),

  categories: () => request<Category[]>('GET', '/categories'),
  createCategory: (name: string, color: Tone) => request<Category>('POST', '/categories', { name, color }),
  updateCategory: (id: number, name: string, color: Tone) => request<Category>('PUT', `/categories/${id}`, { name, color }),
  deleteCategory: (id: number) => request<void>('DELETE', `/categories/${id}`),

  routines: (date: string) => request<Routine[]>('GET', `/routines?date=${date}`),
  createRoutine: (input: RoutineInput) => request<Routine>('POST', '/routines', input),
  updateRoutine: (id: number, input: RoutineInput) => request<Routine>('PUT', `/routines/${id}`, input),
  deleteRoutine: (id: number) => request<void>('DELETE', `/routines/${id}`),
  setStep: (routineId: number, stepId: number, date: string, completed: boolean) =>
    request<void>('PUT', `/routines/${routineId}/steps/${stepId}/completion`, { date, completed }),
  setRoutine: (routineId: number, date: string, completed: boolean) =>
    request<void>('PUT', `/routines/${routineId}/completion`, { date, completed }),

  days: (from: string, to: string, categoryId?: number | null) =>
    request<DayStat[]>('GET', `/calendar?from=${from}&to=${to}${categoryId ? `&categoryId=${categoryId}` : ''}`),
  insights: () => request<Insights>('GET', '/insights'),
}
