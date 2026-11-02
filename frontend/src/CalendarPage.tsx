import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks } from 'lucide-react'
import { useUi } from './context'
import { DAYS, formatLong, formatMonth, formatTime, fromKey, monthGrid } from './dates'
import { HabitRow } from './HabitRow'
import { useDayStats } from './hooks'
import { CategoryChips, Empty, HabitIcon, matchesHabit, Ring } from './ui'

export function CalendarPage() {
  const ui = useUi()
  const { app } = ui
  const selected = fromKey(app.selectedDate)
  const [view, setView] = useState({ year: selected.getFullYear(), month: selected.getMonth() })
  const grid = monthGrid(view.year, view.month)
  const stats = useDayStats(grid[0], grid[41], ui.categoryFilter, app.version)

  const shift = (amount: number) => {
    const next = new Date(view.year, view.month + amount, 1)
    setView({ year: next.getFullYear(), month: next.getMonth() })
  }

  const jumpToToday = () => {
    const now = fromKey(ui.today)
    setView({ year: now.getFullYear(), month: now.getMonth() })
    app.setSelectedDate(ui.today)
  }

  const dayHabits = app.habits
    .filter((habit) => !habit.archived && (habit.dueOnDate || habit.completed))
    .filter((habit) => matchesHabit(habit, ui.search, ui.categoryFilter))

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1>{formatMonth(view.year, view.month)}</h1>
        </div>
        <div className="date-nav">
          <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={18} /></button>
          <button type="button" className="btn small ghost" onClick={jumpToToday}>Today</button>
          <button type="button" className="icon-btn" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={18} /></button>
        </div>
      </header>

      <div className="columns calendar-columns">
        <section className="glass panel">
          <CategoryChips categories={app.categories} value={ui.categoryFilter} onChange={ui.setCategoryFilter} />
          <div className="cal-head">
            {DAYS.map((day) => <span key={day.key}>{day.short}</span>)}
          </div>
          <div className="cal-grid">
            {grid.map((key) => {
              const stat = stats.get(key)
              const value = stat && stat.total ? stat.completed / stat.total : 0
              const inMonth = fromKey(key).getMonth() === view.month
              return (
                <button
                  key={key}
                  type="button"
                  className={`cal-cell ${inMonth ? '' : 'outside'} ${key === app.selectedDate ? 'selected' : ''} ${key === ui.today ? 'today' : ''}`}
                  aria-pressed={key === app.selectedDate}
                  aria-label={`${formatLong(key)}${stat ? `, ${stat.completed} of ${stat.total} done` : ''}`}
                  onClick={() => {
                    app.setSelectedDate(key)
                    if (!inMonth) {
                      const date = fromKey(key)
                      setView({ year: date.getFullYear(), month: date.getMonth() })
                    }
                  }}
                >
                  <Ring value={value} size={42}>{fromKey(key).getDate()}</Ring>
                  <small>{stat && stat.total > 0 ? `${stat.completed}/${stat.total}` : ''}</small>
                </button>
              )
            })}
          </div>
        </section>

        <aside className="stack">
          <section className="glass panel">
            <div className="panel-head">
              <h2>{formatLong(app.selectedDate)}</h2>
              {app.selectedDate !== ui.today && <button type="button" className="link" onClick={() => app.setSelectedDate(ui.today)}>Today</button>}
            </div>
            {dayHabits.length === 0 ? (
              <Empty icon={ListChecks} title="Nothing scheduled" text="No habits match this day." />
            ) : (
              <ul className="habit-list compact">{dayHabits.map((habit) => <HabitRow key={habit.id} habit={habit} />)}</ul>
            )}
          </section>

          <section className="glass panel">
            <div className="panel-head"><h2>Routines</h2></div>
            {app.routines.length === 0 ? (
              <Empty icon={CalendarDays} title="No routines" text="Create one from the Routines page." />
            ) : (
              <ul className="routine-mini">
                {app.routines.map((routine) => (
                  <li key={routine.id} className={`tone-${routine.color}`}>
                    <strong><i className="dot" /> {routine.name} <small className="muted">{formatTime(routine.scheduledTime)}</small></strong>
                    <ul>
                      {routine.steps.map((step) => (
                        <li key={step.id}>
                          <label className={`step ${step.habitId ? 'linked' : ''}`}>
                            <input
                              type="checkbox"
                              checked={step.completed}
                              disabled={app.selectedDate > ui.today}
                              onChange={() => app.toggleStep(routine, step.id)}
                            />
                            {step.habitId && <HabitIcon icon={step.habitIcon ?? 'target'} tone={step.habitColor} small />}
                            <span>{step.name}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
