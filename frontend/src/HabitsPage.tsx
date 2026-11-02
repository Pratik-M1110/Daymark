import { useState } from 'react'
import { Archive, ListChecks, Plus, Tags } from 'lucide-react'
import { useUi } from './context'
import { HabitRow } from './HabitRow'
import { CategoryChips, Empty, matchesHabit } from './ui'

type Tab = 'Active' | 'Archived' | 'All'

export function HabitsPage() {
  const ui = useUi()
  const { app } = ui
  const [tab, setTab] = useState<Tab>('Active')

  const counts = {
    Active: app.habits.filter((habit) => !habit.archived).length,
    Archived: app.habits.filter((habit) => habit.archived).length,
    All: app.habits.length,
  }
  const list = app.habits
    .filter((habit) => (tab === 'All' ? true : tab === 'Archived' ? habit.archived : !habit.archived))
    .filter((habit) => matchesHabit(habit, ui.search, ui.categoryFilter))

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Habits</h1>
          <p className="muted">Create, edit and organise everything you track.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn ghost" onClick={ui.manageCategories}><Tags size={16} /> Categories</button>
          <button type="button" className="btn primary" onClick={() => ui.newHabit()}><Plus size={16} /> New habit</button>
        </div>
      </header>

      <section className="glass panel">
        <div className="tabs" role="tablist">
          {(['Active', 'Archived', 'All'] as Tab[]).map((name) => (
            <button key={name} type="button" role="tab" aria-selected={tab === name} className={`tab ${tab === name ? 'on' : ''}`} onClick={() => setTab(name)}>
              {name} <span className="count">{counts[name]}</span>
            </button>
          ))}
        </div>
        <CategoryChips categories={app.categories} value={ui.categoryFilter} onChange={ui.setCategoryFilter} />

        {list.length === 0 ? (
          <Empty icon={tab === 'Archived' ? Archive : ListChecks} title={tab === 'Archived' ? 'No archived habits' : 'No habits here'} text={tab === 'Archived' ? 'Archived habits keep their history and can be restored.' : 'Create a habit or change your filters.'}>
            {tab !== 'Archived' && <button type="button" className="btn primary small" onClick={() => ui.newHabit()}><Plus size={15} /> New habit</button>}
          </Empty>
        ) : (
          <ul className="habit-list">{list.map((habit) => <HabitRow key={habit.id} habit={habit} mode="manage" />)}</ul>
        )}
      </section>
    </div>
  )
}
