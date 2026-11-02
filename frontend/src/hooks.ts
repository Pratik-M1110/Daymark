import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  api, habitToInput,
  type Category, type CheckInBody, type DayStat, type Habit, type HabitInput, type Insights, type Profile,
  type ReminderDue, type Routine, type RoutineInput, type Tone,
} from './api'
import { ACCENTS, type AccentKey } from './catalog'
import { todayKey } from './dates'

export type ThemePref = 'light' | 'dark' | 'system'

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.')

const storedAccent = (): AccentKey => {
  const value = localStorage.getItem('daymark-accent')
  return ACCENTS.some((accent) => accent.key === value) ? (value as AccentKey) : 'aurora'
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => (localStorage.getItem('daymark-theme') as ThemePref | null) ?? 'system')
  const [accent, setAccent] = useState<AccentKey>(storedAccent)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  const resolved: 'light' | 'dark' = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    document.documentElement.dataset.accent = accent
  }, [resolved, accent])

  const choose = useCallback((next: ThemePref) => {
    localStorage.setItem('daymark-theme', next)
    setPref(next)
  }, [])

  const chooseAccent = useCallback((next: AccentKey) => {
    localStorage.setItem('daymark-accent', next)
    setAccent(next)
  }, [])

  const toggle = useCallback(() => choose(resolved === 'dark' ? 'light' : 'dark'), [choose, resolved])

  return { pref, resolved, accent, choose, chooseAccent, toggle }
}

export type ThemeApi = ReturnType<typeof useTheme>

export function useDayStats(from: string, to: string, categoryId: number | null, version: number) {
  const [stats, setStats] = useState<DayStat[]>([])

  useEffect(() => {
    let cancelled = false
    api.days(from, to, categoryId)
      .then((result) => { if (!cancelled) setStats(result) })
      .catch(() => { if (!cancelled) setStats([]) })
    return () => { cancelled = true }
  }, [from, to, categoryId, version])

  return useMemo(() => new Map(stats.map((stat) => [stat.date, stat])), [stats])
}

export function useInsights(version: number) {
  const [insights, setInsights] = useState<Insights | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.insights()
      .then((result) => { if (!cancelled) { setInsights(result); setError(null) } })
      .catch((reason) => { if (!cancelled) setError(messageOf(reason)) })
    return () => { cancelled = true }
  }, [version])

  return { insights, error }
}

export interface Toast {
  id: number
  text: string
  kind: 'ok' | 'error'
}

export type NotifyPermission = 'unsupported' | 'default' | 'granted' | 'denied'

const nowMinutes = () => {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

/** Polls today's reminders while the app is open and shows a browser notification when one comes due. */
export function useReminders(today: string, version: number) {
  const [due, setDue] = useState<ReminderDue[]>([])
  const [permission, setPermission] = useState<NotifyPermission>(() =>
    'Notification' in window ? Notification.permission : 'unsupported')
  const fired = useRef(new Set<string>())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    api.reminders(today)
      .then((result) => { if (!cancelled) setDue(result) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [today, version, tick])

  useEffect(() => {
    if (permission !== 'granted') return
    const current = nowMinutes()
    for (const reminder of due) {
      const key = `${today}-${reminder.habitId}-${reminder.time}`
      const minutes = minutesOf(reminder.time)
      if (reminder.completed || fired.current.has(key) || minutes > current || current - minutes > 2) continue
      fired.current.add(key)
      new Notification(reminder.habitName, {
        body: reminder.message ?? `Time for ${reminder.habitName}`,
        tag: key,
      })
    }
  }, [due, permission, today, tick])

  const request = useCallback(async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result)
  }, [])

  // Recomputed each render; `tick` re-renders every 30s so the list stays current.
  const current = nowMinutes()
  const upcoming = due.filter((reminder) => !reminder.completed && minutesOf(reminder.time) >= current - 2)

  return { due, upcoming, permission, request }
}

export function useAppData() {
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [habits, setHabits] = useState<Habit[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [toast, setToast] = useState<Toast | null>(null)

  const refresh = useCallback(() => setVersion((value) => value + 1), [])

  const notify = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    setToast({ id: Date.now() + Math.random(), text, kind })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    Promise.all([api.habits(selectedDate), api.routines(selectedDate), api.categories()])
      .then(([nextHabits, nextRoutines, nextCategories]) => {
        if (cancelled) return
        setHabits(nextHabits)
        setRoutines(nextRoutines)
        setCategories(nextCategories)
        setLoadError(null)
        setLoading(false)
      })
      .catch((reason) => {
        if (cancelled) return
        setLoadError(messageOf(reason))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [selectedDate, version])

  useEffect(() => {
    let cancelled = false
    api.profile()
      .then(async (loaded) => {
        const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (browserZone && browserZone !== loaded.timeZone) {
          try {
            loaded = await api.updateProfile({ name: loaded.name, timeZone: browserZone })
            setVersion((value) => value + 1)
          } catch {
            // Keep the stored zone if the browser's is not accepted.
          }
        }
        if (!cancelled) setProfile(loaded)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  const guarded = useCallback(async <T,>(action: () => Promise<T>, success?: string): Promise<T | undefined> => {
    try {
      const result = await action()
      if (success) notify(success)
      return result
    } catch (reason) {
      notify(messageOf(reason), 'error')
      return undefined
    } finally {
      refresh()
    }
  }, [notify, refresh])

  const toggleHabit = useCallback(async (habit: Habit) => {
    const completed = !habit.completed
    setHabits((current) => current.map((item) => item.id === habit.id
      ? { ...item, completed, weekCompleted: Math.max(0, item.weekCompleted + (completed ? 1 : -1)) }
      : item))
    await guarded(() => api.checkIn(habit.id, { date: selectedDate, completed }))
  }, [guarded, selectedDate])

  /** Logs an amount for a measurable habit on the selected date. */
  const logValue = useCallback(async (habit: Habit, value: number) => {
    const safe = Math.max(0, value)
    const completed = habit.targetValue === null ? safe > 0 : safe >= habit.targetValue
    setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, value: safe, completed } : item))
    await guarded(() => api.checkIn(habit.id, { date: selectedDate, value: safe }))
  }, [guarded, selectedDate])

  const setCheckIn = useCallback((habit: Habit, body: CheckInBody) =>
    guarded(() => api.checkIn(habit.id, body)), [guarded])

  const clearCheckIn = useCallback((habit: Habit, date: string) =>
    guarded(() => api.deleteCheckIn(habit.id, date)), [guarded])

  const saveHabit = useCallback(async (id: number | null, input: HabitInput) => {
    const saved = await guarded(
      () => (id === null ? api.createHabit(input) : api.updateHabit(id, input)),
      id === null ? 'Habit created' : 'Habit saved',
    )
    return saved !== undefined
  }, [guarded])

  const archiveHabit = useCallback((habit: Habit) =>
    guarded(() => api.updateHabit(habit.id, { ...habitToInput(habit), archived: !habit.archived }),
      habit.archived ? 'Habit restored' : 'Habit archived'), [guarded])

  const deleteHabit = useCallback((id: number) => guarded(() => api.deleteHabit(id), 'Habit deleted'), [guarded])

  const createCategory = useCallback(async (name: string, color: Tone) =>
    (await guarded(() => api.createCategory(name, color), 'Category created')) ?? null, [guarded])

  const updateCategory = useCallback((id: number, name: string, color: Tone) =>
    guarded(() => api.updateCategory(id, name, color)), [guarded])

  const deleteCategory = useCallback((id: number) =>
    guarded(() => api.deleteCategory(id), 'Category deleted'), [guarded])

  const saveRoutine = useCallback(async (id: number | null, input: RoutineInput) => {
    const saved = await guarded(
      () => (id === null ? api.createRoutine(input) : api.updateRoutine(id, input)),
      id === null ? 'Routine created' : 'Routine saved',
    )
    return saved !== undefined
  }, [guarded])

  const deleteRoutine = useCallback((id: number) => guarded(() => api.deleteRoutine(id), 'Routine deleted'), [guarded])

  /** Appends an existing habit as a step of a routine. */
  const addHabitToRoutine = useCallback(async (routine: Routine, habit: Habit) => {
    const saved = await guarded(() => api.updateRoutine(routine.id, {
      name: routine.name, scheduledTime: routine.scheduledTime, color: routine.color,
      steps: [...routine.steps.map((step) => ({ id: step.id, name: step.name, habitId: step.habitId })), { habitId: habit.id }],
    }), `Added to ${routine.name}`)
    return saved !== undefined
  }, [guarded])

  const toggleStep = useCallback(async (routine: Routine, stepId: number) => {
    const completed = !routine.steps.find((step) => step.id === stepId)?.completed
    setRoutines((current) => current.map((item) => item.id === routine.id
      ? { ...item, steps: item.steps.map((step) => (step.id === stepId ? { ...step, completed } : step)) }
      : item))
    await guarded(() => api.setStep(routine.id, stepId, selectedDate, completed))
  }, [guarded, selectedDate])

  const setRoutineDone = useCallback((routine: Routine, completed: boolean) =>
    guarded(() => api.setRoutine(routine.id, selectedDate, completed)), [guarded, selectedDate])

  const saveName = useCallback(async (name: string) => {
    if (!profile) return
    const saved = await guarded(() => api.updateProfile({ name, timeZone: profile.timeZone }), 'Name saved')
    if (saved) setProfile(saved)
  }, [guarded, profile])

  return {
    selectedDate, setSelectedDate, habits, categories, routines, profile, loading, loadError, version, toast,
    refresh, notify,
    toggleHabit, logValue, setCheckIn, clearCheckIn, saveHabit, archiveHabit, deleteHabit,
    createCategory, updateCategory, deleteCategory,
    saveRoutine, deleteRoutine, addHabitToRoutine, toggleStep, setRoutineDone, saveName,
  }
}

export type AppData = ReturnType<typeof useAppData>
