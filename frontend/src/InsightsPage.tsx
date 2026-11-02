import { Flame, Target, TrendingDown, TrendingUp, Trophy, CheckCheck } from 'lucide-react'
import { DAYS, formatShort } from './dates'
import { useUi } from './context'
import { useInsights } from './hooks'
import { Empty, HabitIcon, Ring } from './ui'

export function InsightsPage() {
  const ui = useUi()
  const { insights, error } = useInsights(ui.app.version)

  if (error) {
    return <div className="page"><div className="glass panel"><p className="error-text">{error}</p></div></div>
  }
  if (!insights) {
    return <div className="page"><div className="glass panel"><p className="muted center">Loading insights...</p></div></div>
  }

  const delta = insights.weekCheckIns - insights.lastWeekCheckIns
  const maxWeek = Math.max(1, ...insights.week.map((day) => day.total))
  const maxCategory = Math.max(1, ...insights.categories.map((category) => category.completed))

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Insights</p>
          <h1>Your progress</h1>
          <p className="muted">Based on your last 30 days of check-ins.</p>
        </div>
      </header>

      <div className="metrics">
        <section className="glass metric">
          <span className="tile tone-emerald"><CheckCheck size={20} /></span>
          <div><strong>{insights.weekCheckIns}</strong><small>check-ins this week</small></div>
          <span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>
            {delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {delta >= 0 ? '+' : ''}{delta} vs last week
          </span>
        </section>
        <section className="glass metric">
          <span className="tile tone-violet"><Target size={20} /></span>
          <div><strong>{insights.completionRate30}%</strong><small>30-day completion</small></div>
        </section>
        <section className="glass metric">
          <span className="tile tone-coral"><Flame size={20} /></span>
          <div><strong>{insights.bestStreak}</strong><small>current best streak</small></div>
        </section>
        <section className="glass metric">
          <span className="tile tone-amber"><Trophy size={20} /></span>
          <div><strong>{insights.longestStreak}</strong><small>longest streak</small></div>
        </section>
      </div>

      {insights.habits.length === 0 ? (
        <section className="glass panel">
          <Empty icon={Target} title="No data yet" text="Create a habit and check it in to see your insights here.">
            <button type="button" className="btn primary small" onClick={() => ui.newHabit()}>New habit</button>
          </Empty>
        </section>
      ) : (
        <div className="columns">
          <section className="glass panel">
            <div className="panel-head"><h2>Habits</h2><span className="muted">Last 7 days</span></div>
            <ul className="insight-list">
              {insights.habits.map((habit) => (
                <li key={habit.id} className={`tone-${habit.categoryColor}`}>
                  <HabitIcon icon={habit.icon} tone={habit.categoryColor} />
                  <div className="insight-main">
                    <strong>{habit.name}</strong>
                    <span className="muted">{habit.streak}-day streak · best {habit.longestStreak}</span>
                  </div>
                  <div className="last7" aria-label="Last 7 days">
                    {habit.last7.map((state, index) => <i key={index} className={`sq ${state}`} title={state} />)}
                  </div>
                  <Ring value={habit.rate30 / 100} size={46} tone={habit.categoryColor}>{habit.rate30}</Ring>
                </li>
              ))}
            </ul>
          </section>

          <aside className="stack">
            <section className="glass panel">
              <div className="panel-head"><h2>This week</h2></div>
              <div className="bars tall">
                {insights.week.map((day, index) => (
                  <div key={day.date} className="bar static" title={`${formatShort(day.date)}: ${day.completed}/${day.total}`}>
                    <span className="bar-track">
                      <span className="bar-fill" style={{ height: `${(day.completed / maxWeek) * 100}%` }} />
                    </span>
                    <small>{DAYS[index].letter}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass panel">
              <div className="panel-head"><h2>By category</h2><span className="muted">30 days</span></div>
              <ul className="category-bars">
                {insights.categories.map((category) => (
                  <li key={category.name} className={`tone-${category.color}`}>
                    <div><i className="dot" /> {category.name}<span className="muted">{category.completed}</span></div>
                    <span className="progress"><span style={{ width: `${(category.completed / maxCategory) * 100}%` }} /></span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
