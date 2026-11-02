import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell, BellRing, CalendarDays, ChartNoAxesColumn, CheckCircle2, Home, ListChecks, ListTodo, Moon, Palette, Plus, Search,
  Settings, Sun, TriangleAlert, type LucideIcon,
} from 'lucide-react'
import type { Habit, Routine } from './api'
import { ACCENTS, type Page } from './catalog'
import { CalendarPage } from './CalendarPage'
import { UiContext, type Ui } from './context'
import {
  AddToRoutineDialog, CategoryDialog, ConfirmDialog, HabitDialog, HistoryDialog, RoutineDialog, type HabitPrefill,
} from './dialogs'
import { HabitsPage } from './HabitsPage'
import { useAppData, useReminders, useTheme } from './hooks'
import { InsightsPage } from './InsightsPage'
import { RoutinesPage } from './RoutinesPage'
import { SettingsPage } from './SettingsPage'
import { TodayPage } from './TodayPage'
import { todayKey } from './dates'

type Dialog =
  | { type: 'habit'; habit: Habit | null; prefill?: HabitPrefill }
  | { type: 'history'; habit: Habit }
  | { type: 'add-to-routine'; habit: Habit }
  | { type: 'routine'; routine: Routine | null; seedHabit?: Habit }
  | { type: 'categories' }
  | { type: 'confirm'; title: string; message: string; label: string; action: () => void }

const NAV: { page: Page; icon: LucideIcon }[] = [
  { page: 'Today', icon: Home },
  { page: 'Calendar', icon: CalendarDays },
  { page: 'Habits', icon: ListChecks },
  { page: 'Routines', icon: ListTodo },
  { page: 'Insights', icon: ChartNoAxesColumn },
  { page: 'Settings', icon: Settings },
]

export default function App() {
  const app = useAppData()
  const theme = useTheme()
  const today = todayKey()
  const reminders = useReminders(today, app.version)
  const [page, setPage] = useState<Page>('Today')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [popover, setPopover] = useState<'bell' | 'palette' | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!popover) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!bellRef.current?.contains(target) && !paletteRef.current?.contains(target)) setPopover(null)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setPopover(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [popover])

  useEffect(() => {
    if (categoryFilter !== null && !app.loading && !app.categories.some((category) => category.id === categoryFilter)) {
      setCategoryFilter(null)
    }
  }, [app.categories, app.loading, categoryFilter])

  const pending = app.habits.filter((habit) => !habit.archived && habit.dueOnDate && !habit.completed)
  const badge = pending.length

  const ui = useMemo<Ui>(() => ({
    app,
    theme,
    reminders,
    today,
    search,
    categoryFilter,
    setCategoryFilter,
    go: (next) => { setPage(next); window.scrollTo({ top: 0 }) },
    newHabit: (prefill) => setDialog({ type: 'habit', habit: null, prefill }),
    editHabit: (habit) => setDialog({ type: 'habit', habit }),
    editHistory: (habit) => setDialog({ type: 'history', habit }),
    addToRoutine: (habit) => setDialog({ type: 'add-to-routine', habit }),
    archiveHabit: (habit) => { void app.archiveHabit(habit) },
    deleteHabit: (habit) => setDialog({
      type: 'confirm',
      title: 'Delete habit?',
      message: `"${habit.name}" and all of its history will be removed permanently.`,
      label: 'Delete habit',
      action: () => { void app.deleteHabit(habit.id) },
    }),
    newRoutine: (seedHabit) => setDialog({ type: 'routine', routine: null, seedHabit }),
    editRoutine: (routine) => setDialog({ type: 'routine', routine }),
    deleteRoutine: (routine) => setDialog({
      type: 'confirm',
      title: 'Delete routine?',
      message: `"${routine.name}" and its step history will be removed permanently.`,
      label: 'Delete routine',
      action: () => { void app.deleteRoutine(routine.id) },
    }),
    manageCategories: () => setDialog({ type: 'categories' }),
  }), [app, theme, reminders, today, search, categoryFilter])

  const close = () => setDialog(null)

  return (
    <UiContext.Provider value={ui}>
      <div className="orbs" aria-hidden="true"><i /><i /><i /></div>

      <div className="shell">
        <aside className="sidebar glass">
          <div className="brand">
            <span className="brand-mark"><CheckCircle2 size={20} /></span>
            <strong>Daymark</strong>
          </div>
          <nav aria-label="Main">
            {NAV.map(({ page: name, icon: Icon }) => (
              <button key={name} type="button" className={`nav-item ${page === name ? 'on' : ''}`} aria-current={page === name ? 'page' : undefined} onClick={() => ui.go(name)}>
                <Icon size={19} /> {name}
              </button>
            ))}
          </nav>
          <div className="side-foot glass-item">
            <span className="avatar">{(app.profile?.name ?? 'Y').slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{app.profile?.name ?? 'You'}</strong>
              <small className="muted">Local profile</small>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar glass">
            <label className="search">
              <Search size={17} />
              <input ref={searchRef} value={search} placeholder="Search habits   Ctrl K" aria-label="Search habits" onChange={(event) => setSearch(event.target.value)} />
            </label>

            <div className="menu-root" ref={bellRef}>
              <button type="button" className="icon-btn" aria-label="Pending habits and reminders" aria-expanded={popover === 'bell'} onClick={() => setPopover((value) => (value === 'bell' ? null : 'bell'))}>
                <Bell size={18} />
                {badge > 0 && <span className="badge">{badge}</span>}
              </button>
              {popover === 'bell' && (
                <div className="popover bell glass-strong" role="dialog" aria-label="Pending habits and reminders">
                  <strong>{pending.length === 0 ? 'All caught up' : `${pending.length} still to do`}</strong>
                  {pending.length === 0 ? (
                    <p className="muted">Nothing pending for this date.</p>
                  ) : (
                    <ul>
                      {pending.slice(0, 6).map((habit) => <li key={habit.id}>{habit.name}</li>)}
                    </ul>
                  )}
                  {reminders.upcoming.length > 0 && (
                    <>
                      <strong className="inline-ic"><BellRing size={14} /> Coming up today</strong>
                      <ul className="plain">
                        {reminders.upcoming.slice(0, 5).map((reminder) => (
                          <li key={`${reminder.habitId}-${reminder.time}`} className={`tone-${reminder.categoryColor}`}>
                            <i className="dot" /> <span className="grow">{reminder.habitName}</span> <small className="muted">{reminder.time.slice(0, 5)}</small>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {reminders.permission === 'default' && (
                    <button type="button" className="link" onClick={() => void reminders.request()}>Enable browser notifications</button>
                  )}
                  <button type="button" className="link" onClick={() => { setPopover(null); ui.go('Today') }}>Go to Today</button>
                </div>
              )}
            </div>

            <div className="menu-root" ref={paletteRef}>
              <button type="button" className="icon-btn" aria-label="Colour theme" aria-expanded={popover === 'palette'} onClick={() => setPopover((value) => (value === 'palette' ? null : 'palette'))}>
                <Palette size={18} />
              </button>
              {popover === 'palette' && (
                <div className="popover palette glass-strong" role="dialog" aria-label="Colour theme">
                  {ACCENTS.map((accent) => (
                    <button
                      key={accent.key}
                      type="button"
                      className={`accent-option small ${theme.accent === accent.key ? 'on' : ''}`}
                      style={{ '--from': accent.from, '--to': accent.to } as React.CSSProperties}
                      aria-pressed={theme.accent === accent.key}
                      onClick={() => theme.chooseAccent(accent.key)}
                    >
                      <i className="accent-preview" /><span>{accent.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" className="icon-btn" aria-label={`Switch to ${theme.resolved === 'dark' ? 'light' : 'dark'} mode`} onClick={theme.toggle}>
              {theme.resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button type="button" className="icon-btn only-mobile" aria-label="Settings" onClick={() => ui.go('Settings')}><Settings size={18} /></button>
            <button type="button" className="btn primary" onClick={() => ui.newHabit()}><Plus size={16} /> <span className="hide-sm">New habit</span></button>
          </header>

          {app.loadError && (
            <div className="banner glass" role="alert">
              <TriangleAlert size={18} />
              <span>{app.loadError}</span>
              <button type="button" className="btn small" onClick={app.refresh}>Retry</button>
            </div>
          )}

          <main>
            {page === 'Today' && <TodayPage />}
            {page === 'Calendar' && <CalendarPage />}
            {page === 'Habits' && <HabitsPage />}
            {page === 'Routines' && <RoutinesPage />}
            {page === 'Insights' && <InsightsPage />}
            {page === 'Settings' && <SettingsPage />}
          </main>
        </div>

        <nav className="bottom-nav glass" aria-label="Main (mobile)">
          {NAV.slice(0, 5).map(({ page: name, icon: Icon }) => (
            <button key={name} type="button" className={`nav-item ${page === name ? 'on' : ''}`} onClick={() => ui.go(name)}>
              <Icon size={20} />
              <small>{name}</small>
            </button>
          ))}
        </nav>
      </div>

      {dialog?.type === 'habit' && <HabitDialog habit={dialog.habit} prefill={dialog.prefill} app={app} onClose={close} />}
      {dialog?.type === 'history' && <HistoryDialog habit={dialog.habit} app={app} today={today} onClose={close} />}
      {dialog?.type === 'add-to-routine' && (
        <AddToRoutineDialog habit={dialog.habit} app={app} onNewRoutine={() => setDialog({ type: 'routine', routine: null, seedHabit: dialog.habit })} onClose={close} />
      )}
      {dialog?.type === 'routine' && <RoutineDialog routine={dialog.routine} seedHabit={dialog.seedHabit} app={app} onClose={close} />}
      {dialog?.type === 'categories' && <CategoryDialog app={app} onClose={close} />}
      {dialog?.type === 'confirm' && <ConfirmDialog title={dialog.title} message={dialog.message} confirmLabel={dialog.label} onConfirm={dialog.action} onClose={close} />}

      {app.toast && (
        <div key={app.toast.id} className={`toast glass-strong ${app.toast.kind}`} role="status">
          {app.toast.kind === 'error' ? <TriangleAlert size={16} /> : <CheckCircle2 size={16} />} {app.toast.text}
        </div>
      )}
    </UiContext.Provider>
  )
}
