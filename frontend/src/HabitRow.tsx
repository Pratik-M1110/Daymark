import { useEffect, useState } from 'react'
import { Archive, ArchiveRestore, BellRing, CalendarClock, Check, Flame, ListPlus, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Habit } from './api'
import { useUi } from './context'
import { HabitIcon, Ring, RowMenu } from './ui'

const fmt = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, ''))

/** Stepper plus editable amount for measurable habits. */
function MeasureControl({ habit, disabled }: { habit: Habit; disabled: boolean }) {
  const ui = useUi()
  const value = habit.value ?? 0
  const target = habit.targetValue ?? 0
  const [draft, setDraft] = useState(fmt(value))
  const [editing, setEditing] = useState(false)
  const step = target >= 20 ? 5 : 1

  useEffect(() => { if (!editing) setDraft(fmt(value)) }, [value, editing])

  const commit = () => {
    setEditing(false)
    const next = Number(draft)
    if (!Number.isNaN(next) && next !== value) void ui.app.logValue(habit, next)
  }

  return (
    <div className={`measure tone-${habit.categoryColor ?? 'slate'}`}>
      <button type="button" className="icon-btn mini" aria-label={`Decrease ${habit.name}`} disabled={disabled || value <= 0} onClick={() => ui.app.logValue(habit, Math.max(0, value - step))}>
        <Minus size={14} />
      </button>
      {editing ? (
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={draft}
          aria-label={`Amount for ${habit.name}`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => { if (event.key === 'Enter') commit(); if (event.key === 'Escape') setEditing(false) }}
        />
      ) : (
        <button type="button" className="measure-value" disabled={disabled} title="Tap to type an amount" onClick={() => setEditing(true)}>
          <strong>{fmt(value)}</strong><span className="muted">/ {fmt(target)} {habit.unit ?? ''}</span>
        </button>
      )}
      <button type="button" className="icon-btn mini" aria-label={`Increase ${habit.name}`} disabled={disabled} onClick={() => ui.app.logValue(habit, value + step)}>
        <Plus size={14} />
      </button>
    </div>
  )
}

export function HabitRow({ habit, mode = 'check' }: { habit: Habit; mode?: 'check' | 'manage' }) {
  const ui = useUi()
  const future = ui.app.selectedDate > ui.today
  const tone = habit.categoryColor ?? 'slate'
  const measurable = habit.trackType === 'MEASURABLE'
  const ratio = measurable && habit.targetValue ? Math.min(1, (habit.value ?? 0) / habit.targetValue) : habit.completed ? 1 : 0
  const activeReminders = habit.reminders.filter((reminder) => reminder.enabled)

  return (
    <li className={`habit-row glass-item tone-${tone} ${habit.completed && mode === 'check' ? 'done' : ''} ${habit.archived ? 'archived' : ''} ${measurable ? 'measurable' : ''}`}>
      {mode === 'check' && (
        measurable ? (
          <Ring value={ratio} size={34} tone={tone}>{habit.completed ? <Check size={14} strokeWidth={3} /> : null}</Ring>
        ) : (
          <button
            type="button"
            className={`check ${habit.completed ? 'on' : ''}`}
            aria-pressed={habit.completed}
            aria-label={`${habit.completed ? 'Mark not done' : 'Mark done'}: ${habit.name}`}
            disabled={future}
            title={future ? 'You can only check in up to today' : undefined}
            onClick={() => ui.app.toggleHabit(habit)}
          >
            <Check size={18} strokeWidth={3} />
          </button>
        )
      )}
      <HabitIcon icon={habit.icon} tone={habit.categoryColor} />
      <div className="habit-main">
        <strong>{habit.name}</strong>
        <span className="meta">
          {habit.categoryName && <span className="tag">{habit.categoryName}</span>}
          <span>{measurable ? `Target ${habit.goal}` : habit.goal}</span>
          <span>{habit.weekCompleted}/{habit.weeklyTarget} this week</span>
          {activeReminders.length > 0 && (
            <span className="inline-ic" title={activeReminders.map((reminder) => reminder.time.slice(0, 5)).join(', ')}>
              <BellRing size={12} /> {activeReminders[0].time.slice(0, 5)}{activeReminders.length > 1 ? ` +${activeReminders.length - 1}` : ''}
            </span>
          )}
        </span>
      </div>
      {mode === 'check' && measurable && <MeasureControl habit={habit} disabled={future} />}
      {habit.streak > 0 && (
        <span className="streak" title={`${habit.streak}-day streak`}><Flame size={15} /> {habit.streak}</span>
      )}
      <RowMenu
        label={`Options for ${habit.name}`}
        items={[
          { label: 'Edit', icon: Pencil, onSelect: () => ui.editHabit(habit) },
          { label: 'History', icon: CalendarClock, onSelect: () => ui.editHistory(habit) },
          { label: 'Add to routine', icon: ListPlus, onSelect: () => ui.addToRoutine(habit) },
          { label: habit.archived ? 'Restore' : 'Archive', icon: habit.archived ? ArchiveRestore : Archive, onSelect: () => ui.archiveHabit(habit) },
          { label: 'Delete', icon: Trash2, danger: true, onSelect: () => ui.deleteHabit(habit) },
        ]}
      />
    </li>
  )
}
