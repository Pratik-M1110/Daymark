import { CalendarCheck, ChevronLeft, ChevronRight, Flame, ListChecks, Plus, Sparkles } from 'lucide-react'
import { SUGGESTIONS } from './catalog'
import { useUi } from './context'
import { addDays, formatLong, formatShort, weekKeys, DAYS, fromKey } from './dates'
import { HabitRow } from './HabitRow'
import { useDayStats } from './hooks'
import { CategoryChips, Empty, matchesHabit, Ring } from './ui'

const greeting = () => {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

export function TodayPage() {
  const ui = useUi()
  const { app } = ui
  const { selectedDate, habits, routines, categories } = app
  const week = weekKeys(selectedDate)
  const stats = useDayStats(week[0], week[6], null, app.version)

  const due = habits.filter((habit) => !habit.archived && (habit.dueOnDate || habit.completed))
  const done = due.filter((habit) => habit.completed).length
  const list = due.filter((habit) => matchesHabit(habit, ui.search, ui.categoryFilter))
  const active = habits.filter((habit) => !habit.archived)
  const best = [...active].sort((a, b) => b.streak - a.streak)[0]
  const isToday = selectedDate === ui.today
  const ratio = due.length ? done / due.length : 0

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{isToday ? 'Today' : selectedDate > ui.today ? 'Upcoming' : 'Earlier'}</p>
          <h1>{isToday ? `${greeting()}, ${app.profile?.name ?? 'there'}` : formatLong(selectedDate)}</h1>
          {isToday && <p className="muted">{formatLong(selectedDate)}</p>}
        </div>
        <div className="date-nav">
          <button type="button" className="icon-btn" aria-label="Previous day" onClick={() => app.setSelectedDate(addDays(selectedDate, -1))}><ChevronLeft size={18} /></button>
          {!isToday && <button type="button" className="btn small ghost" onClick={() => app.setSelectedDate(ui.today)}>Today</button>}
          <button type="button" className="icon-btn" aria-label="Next day" onClick={() => app.setSelectedDate(addDays(selectedDate, 1))}><ChevronRight size={18} /></button>
        </div>
      </header>

      <section className="week-strip glass" aria-label="This week">
        {week.map((key, index) => {
          const stat = stats.get(key)
          const value = stat && stat.total ? stat.completed / stat.total : 0
          return (
            <button
              key={key}
              type="button"
              className={`week-day ${key === selectedDate ? 'selected' : ''} ${key === ui.today ? 'today' : ''}`}
              aria-pressed={key === selectedDate}
              aria-label={formatLong(key)}
              onClick={() => app.setSelectedDate(key)}
            >
              <small>{DAYS[index].short}</small>
              <Ring value={value} size={44}>{fromKey(key).getDate()}</Ring>
            </button>
          )
        })}
      </section>

      <div className="columns">
        <div className="stack">
          <section className="hero glass">
            <Ring value={ratio} size={96}>{Math.round(ratio * 100)}%</Ring>
            <div>
              <h2>{due.length === 0 ? 'A free day' : done === due.length ? 'All done. Lovely work.' : `${done} of ${due.length} habits done`}</h2>
              <p className="muted">
                {due.length === 0
                  ? 'Nothing is scheduled for this date.'
                  : done === due.length
                    ? 'Take a moment to enjoy it.'
                    : `${due.length - done} left ${isToday ? 'for today' : 'on this day'}. Small steps count.`}
              </p>
            </div>
            <button type="button" className="btn primary" onClick={() => ui.newHabit()}><Plus size={16} /> New habit</button>
          </section>

          <section className="glass panel">
            <div className="panel-head">
              <h2>Habits</h2>
              <span className="muted">{list.length} shown</span>
            </div>
            {active.length > 0 && <CategoryChips categories={categories} value={ui.categoryFilter} onChange={ui.setCategoryFilter} />}

            {app.loading ? (
              <p className="muted center">Loading...</p>
            ) : active.length === 0 ? (
              <Empty icon={Sparkles} title="Start your first habit" text="Pick a suggestion or create your own.">
                <div className="suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion.name} type="button" className="btn ghost small" onClick={() => ui.newHabit(suggestion)}>
                      <Plus size={14} /> {suggestion.name}
                    </button>
                  ))}
                </div>
              </Empty>
            ) : list.length === 0 ? (
              <Empty icon={ListChecks} title="Nothing to show" text={due.length === 0 ? 'No habits are scheduled for this date.' : 'No habits match your search or category.'} />
            ) : (
              <ul className="habit-list">{list.map((habit) => <HabitRow key={habit.id} habit={habit} />)}</ul>
            )}
          </section>
        </div>

        <aside className="stack">
          <section className="glass panel">
            <div className="panel-head"><h2>This week</h2></div>
            <div className="bars">
              {week.map((key, index) => {
                const stat = stats.get(key)
                const value = stat && stat.total ? stat.completed / stat.total : 0
                return (
                  <button key={key} type="button" className={`bar ${key === selectedDate ? 'selected' : ''}`} aria-label={`${formatShort(key)}: ${stat?.completed ?? 0} of ${stat?.total ?? 0}`} onClick={() => app.setSelectedDate(key)}>
                    <span className="bar-track"><span className="bar-fill" style={{ height: `${Math.max(value * 100, value > 0 ? 8 : 0)}%` }} /></span>
                    <small>{DAYS[index].letter}</small>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="glass panel streak-card">
            <span className="tile tone-coral"><Flame size={22} /></span>
            <div>
              <h2>{best && best.streak > 0 ? `${best.streak}-day streak` : 'No streak yet'}</h2>
              <p className="muted">{best && best.streak > 0 ? `Keep ${best.name} going.` : 'Complete a habit today to begin one.'}</p>
            </div>
          </section>

          <section className="glass panel">
            <div className="panel-head">
              <h2>Routines</h2>
              <button type="button" className="link" onClick={() => ui.go('Routines')}>Open</button>
            </div>
            {routines.length === 0 ? (
              <p className="muted">Group habits into a morning or evening flow.</p>
            ) : (
              <ul className="mini-list">
                {routines.map((routine) => {
                  const finished = routine.steps.filter((step) => step.completed).length
                  return (
                    <li key={routine.id} className={`tone-${routine.color}`}>
                      <i className="dot" />
                      <span>{routine.name}</span>
                      <small className="muted">{finished}/{routine.steps.length}</small>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="head-actions">
              <button type="button" className="btn ghost small" onClick={() => ui.newRoutine()}><Plus size={15} /> New routine</button>
              <button type="button" className="btn ghost small" onClick={() => ui.go('Calendar')}><CalendarCheck size={15} /> Open calendar</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
