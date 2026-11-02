import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BellPlus, BellRing, Check, ChevronLeft, ChevronRight, Eraser, Link2, ListTodo, Plus, Trash2, X } from 'lucide-react'
import { api, type Category, type CheckInEntry, type Habit, type Reminder, type Routine, type Tone, type TrackType } from './api'
import { ICONS, REPEATS, TONES, UNITS } from './catalog'
import { DAYS, formatLong, formatMonth, fromKey, monthGrid, toKey } from './dates'
import type { AppData } from './hooks'
import { HabitIcon, Modal } from './ui'

function ToneSwatches({ value, onChange }: { value: Tone; onChange: (tone: Tone) => void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Colour">
      {TONES.map((tone) => (
        <button
          key={tone}
          type="button"
          role="radio"
          aria-checked={value === tone}
          aria-label={tone}
          className={`swatch tone-${tone} ${value === tone ? 'on' : ''}`}
          onClick={() => onChange(tone)}
        >
          {value === tone && <Check size={14} strokeWidth={3} />}
        </button>
      ))}
    </div>
  )
}

function DayPicker({ value, onToggle, compact }: { value: Set<string>; onToggle: (key: string) => void; compact?: boolean }) {
  return (
    <div className={`day-picker ${compact ? 'compact' : ''}`}>
      {DAYS.map((day) => (
        <button
          key={day.key}
          type="button"
          aria-pressed={value.has(day.key)}
          className={`day ${value.has(day.key) ? 'on' : ''}`}
          onClick={() => onToggle(day.key)}
          title={day.key.toLowerCase()}
        >
          {compact ? day.letter : day.short}
        </button>
      ))}
    </div>
  )
}

const toggleIn = (set: Set<string>, key: string) => {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export interface HabitPrefill {
  name: string
  category: string
  icon: string
  goal: string
  trackType?: TrackType
  targetValue?: number | null
  unit?: string | null
}

interface ReminderDraft extends Reminder {
  key: number
}

function ReminderEditor({ reminders, onChange }: { reminders: ReminderDraft[]; onChange: (next: ReminderDraft[]) => void }) {
  const nextKey = useRef(1000)
  const update = (key: number, patch: Partial<Reminder>) =>
    onChange(reminders.map((item) => (item.key === key ? { ...item, ...patch } : item)))

  return (
    <div className="field">
      <span>Reminders</span>
      {reminders.length === 0 && <small className="muted">No reminders. Add one to get a browser notification at a set time.</small>}
      <ul className="reminder-list">
        {reminders.map((reminder) => (
          <li key={reminder.key} className={`reminder glass-item ${reminder.enabled ? '' : 'off'}`}>
            <div className="reminder-top">
              <BellRing size={16} className="muted" />
              <input
                type="time"
                value={reminder.time}
                aria-label="Reminder time"
                required
                onChange={(event) => update(reminder.key, { time: event.target.value })}
              />
              <select
                value={reminder.repeat}
                aria-label="Repeat"
                onChange={(event) => update(reminder.key, { repeat: event.target.value as Reminder['repeat'] })}
              >
                {REPEATS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <label className="switch" title={reminder.enabled ? 'Enabled' : 'Paused'}>
                <input type="checkbox" checked={reminder.enabled} onChange={(event) => update(reminder.key, { enabled: event.target.checked })} />
                <i />
              </label>
              <button type="button" className="icon-btn" aria-label="Remove reminder" onClick={() => onChange(reminders.filter((item) => item.key !== reminder.key))}>
                <X size={16} />
              </button>
            </div>
            {reminder.repeat === 'CUSTOM_DAYS' && (
              <DayPicker compact value={new Set(reminder.days)} onToggle={(key) => update(reminder.key, { days: [...toggleIn(new Set(reminder.days), key)] })} />
            )}
            {reminder.repeat === 'EVERY_N_DAYS' && (
              <label className="inline-field">
                <span>Every</span>
                <input
                  type="number"
                  min={2}
                  max={365}
                  value={reminder.intervalDays ?? 2}
                  aria-label="Days between reminders"
                  onChange={(event) => update(reminder.key, { intervalDays: Math.max(2, Number(event.target.value) || 2) })}
                />
                <span>days, counted from the habit's start date</span>
              </label>
            )}
            <input
              value={reminder.message ?? ''}
              maxLength={120}
              placeholder="Message (optional)"
              aria-label="Reminder message"
              onChange={(event) => update(reminder.key, { message: event.target.value || null })}
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn small ghost"
        disabled={reminders.length >= 10}
        onClick={() => onChange([...reminders, { key: nextKey.current++, time: '08:00', repeat: 'HABIT_DAYS', days: [], intervalDays: null, message: null, enabled: true }])}
      >
        <BellPlus size={15} /> Add reminder
      </button>
    </div>
  )
}

export function HabitDialog({ habit, prefill, app, onClose }: { habit: Habit | null; prefill?: HabitPrefill; app: AppData; onClose: () => void }) {
  const [name, setName] = useState(habit?.name ?? prefill?.name ?? '')
  const [categoryId, setCategoryId] = useState<number | null>(
    habit?.categoryId ?? app.categories.find((category) => category.name === prefill?.category)?.id ?? null,
  )
  const [icon, setIcon] = useState(habit?.icon ?? prefill?.icon ?? 'flower')
  const [goal, setGoal] = useState(habit?.trackType === 'MEASURABLE' ? '' : (habit?.goal ?? prefill?.goal ?? ''))
  const [trackType, setTrackType] = useState<TrackType>(habit?.trackType ?? prefill?.trackType ?? 'YES_NO')
  const [target, setTarget] = useState(String(habit?.targetValue ?? prefill?.targetValue ?? ''))
  const [unit, setUnit] = useState(habit?.unit ?? prefill?.unit ?? '')
  const [days, setDays] = useState<Set<string>>(new Set(habit?.scheduledDays ?? DAYS.map((day) => day.key)))
  const [reminders, setReminders] = useState<ReminderDraft[]>(
    (habit?.reminders ?? []).map((reminder, index) => ({ ...reminder, key: index, time: reminder.time.slice(0, 5) })),
  )
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTone, setNewTone] = useState<Tone>('violet')
  const [saving, setSaving] = useState(false)

  const targetNumber = Number(target)
  const targetOk = trackType !== 'MEASURABLE' || (target.trim() !== '' && targetNumber > 0)
  const remindersOk = reminders.every((reminder) =>
    reminder.time && (reminder.repeat !== 'CUSTOM_DAYS' || reminder.days.length > 0))
  const valid = name.trim() !== '' && days.size > 0 && targetOk && remindersOk

  const createCategory = async () => {
    if (!newName.trim()) return
    const created = await app.createCategory(newName.trim(), newTone)
    if (created) {
      setCategoryId(created.id)
      setAdding(false)
      setNewName('')
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    setSaving(true)
    const ok = await app.saveHabit(habit?.id ?? null, {
      name: name.trim(), categoryId, icon, goal: goal.trim() || 'Once',
      scheduledDays: DAYS.filter((day) => days.has(day.key)).map((day) => day.key),
      archived: habit?.archived,
      trackType,
      targetValue: trackType === 'MEASURABLE' ? targetNumber : null,
      unit: trackType === 'MEASURABLE' && unit.trim() ? unit.trim() : null,
      reminders: reminders.map(({ key: _key, ...reminder }) => ({
        ...reminder,
        intervalDays: reminder.repeat === 'EVERY_N_DAYS' ? (reminder.intervalDays ?? 2) : null,
        days: reminder.repeat === 'CUSTOM_DAYS' ? reminder.days : [],
      })),
    })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal title={habit ? 'Edit habit' : 'New habit'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Name</span>
          <input autoFocus value={name} maxLength={80} placeholder="e.g. Morning stretch" onChange={(event) => setName(event.target.value)} required />
        </label>

        <div className="field">
          <span>How do you track it?</span>
          <div className="segmented" role="radiogroup" aria-label="Tracking type">
            <button type="button" role="radio" aria-checked={trackType === 'YES_NO'} className={trackType === 'YES_NO' ? 'on' : ''} onClick={() => setTrackType('YES_NO')}>
              <strong>Yes / No</strong>
              <small>Did I do it today?</small>
            </button>
            <button type="button" role="radio" aria-checked={trackType === 'MEASURABLE'} className={trackType === 'MEASURABLE' ? 'on' : ''} onClick={() => setTrackType('MEASURABLE')}>
              <strong>Measurable</strong>
              <small>Log an amount against a target</small>
            </button>
          </div>
        </div>

        {trackType === 'MEASURABLE' ? (
          <div className="grid-2 even">
            <label className="field">
              <span>Daily target</span>
              <input type="number" inputMode="decimal" min={0.01} step="any" value={target} placeholder="e.g. 4" onChange={(event) => setTarget(event.target.value)} required />
            </label>
            <label className="field">
              <span>Unit</span>
              <input value={unit} maxLength={24} list="unit-options" placeholder="km, pages, glasses..." onChange={(event) => setUnit(event.target.value)} />
              <datalist id="unit-options">{UNITS.map((option) => <option key={option} value={option} />)}</datalist>
            </label>
          </div>
        ) : (
          <label className="field">
            <span>Goal label</span>
            <input value={goal} maxLength={40} placeholder="Once, 10 min, before bed..." onChange={(event) => setGoal(event.target.value)} />
          </label>
        )}

        <div className="field">
          <span>Category</span>
          <div className="chips wrap">
            <button type="button" className={`chip ${categoryId === null ? 'on' : ''}`} onClick={() => setCategoryId(null)}>None</button>
            {app.categories.map((category: Category) => (
              <button
                key={category.id}
                type="button"
                className={`chip tone-${category.color} ${categoryId === category.id ? 'on' : ''}`}
                onClick={() => setCategoryId(category.id)}
              >
                <i className="dot" /> {category.name}
              </button>
            ))}
            <button type="button" className="chip ghost" onClick={() => setAdding((value) => !value)}>
              <Plus size={14} /> New category
            </button>
          </div>
          {adding && (
            <div className="inline-card glass-item">
              <input
                value={newName}
                maxLength={32}
                placeholder="Category name"
                aria-label="New category name"
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void createCategory() } }}
              />
              <ToneSwatches value={newTone} onChange={setNewTone} />
              <button type="button" className="btn small" disabled={!newName.trim()} onClick={() => void createCategory()}>Create category</button>
            </div>
          )}
        </div>

        <div className="field">
          <span>Icon</span>
          <div className="icon-grid">
            {Object.entries(ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                aria-label={key}
                aria-pressed={icon === key}
                className={`icon-choice ${icon === key ? 'on' : ''}`}
                onClick={() => setIcon(key)}
              >
                <Icon size={20} />
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Repeat on</span>
          <DayPicker value={days} onToggle={(key) => setDays((current) => toggleIn(current, key))} />
          {days.size === 0 && <small className="error-text">Pick at least one day.</small>}
        </div>

        <ReminderEditor reminders={reminders} onChange={setReminders} />

        <footer className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving || !valid}>
            {saving ? 'Saving...' : habit ? 'Save changes' : 'Create habit'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}

const fmt = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, ''))

/** Add, change or remove tracking data for any past day. */
export function HistoryDialog({ habit, app, today, onClose }: { habit: Habit; app: AppData; today: string; onClose: () => void }) {
  const start = fromKey(app.selectedDate <= today ? app.selectedDate : today)
  const [view, setView] = useState({ year: start.getFullYear(), month: start.getMonth() })
  const [selected, setSelected] = useState(app.selectedDate <= today ? app.selectedDate : today)
  const [entries, setEntries] = useState<Map<string, CheckInEntry>>(new Map())
  const [draft, setDraft] = useState('')
  const [reload, setReload] = useState(0)
  const grid = useMemo(() => monthGrid(view.year, view.month), [view])
  const measurable = habit.trackType === 'MEASURABLE'

  useEffect(() => {
    let cancelled = false
    api.checkIns(habit.id, grid[0], grid[41])
      .then((list) => { if (!cancelled) setEntries(new Map(list.map((entry) => [entry.date, entry]))) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [habit.id, grid, reload])

  const entry = entries.get(selected)
  useEffect(() => { setDraft(entry?.value != null ? fmt(entry.value) : '') }, [entry, selected])

  const apply = async (action: Promise<unknown>) => {
    await action
    setReload((value) => value + 1)
  }

  const shift = (amount: number) => {
    const next = new Date(view.year, view.month + amount, 1)
    setView({ year: next.getFullYear(), month: next.getMonth() })
  }

  const stateOf = (key: string) => {
    const item = entries.get(key)
    if (!item) return 'none'
    if (item.completed) return 'done'
    if (measurable && item.value && item.value > 0) return 'partial'
    return 'skipped'
  }

  const isScheduled = (key: string) => habit.scheduledDays.includes(DAYS[(fromKey(key).getDay() + 6) % 7].key)

  return (
    <Modal title={`History: ${habit.name}`} onClose={onClose}>
      <div className="history-head">
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={18} /></button>
        <strong>{formatMonth(view.year, view.month)}</strong>
        <button type="button" className="icon-btn" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={18} /></button>
      </div>
      <div className="cal-head">{DAYS.map((day) => <span key={day.key}>{day.letter}</span>)}</div>
      <div className="history-grid">
        {grid.map((key) => {
          const future = key > today
          const inMonth = fromKey(key).getMonth() === view.month
          const state = stateOf(key)
          const value = entries.get(key)?.value
          return (
            <button
              key={key}
              type="button"
              disabled={future}
              aria-pressed={key === selected}
              aria-label={`${formatLong(key)}: ${state}`}
              className={`history-cell ${state} ${inMonth ? '' : 'outside'} ${key === selected ? 'selected' : ''} ${key === today ? 'today' : ''} ${isScheduled(key) ? '' : 'rest'}`}
              onClick={() => setSelected(key)}
            >
              <span>{fromKey(key).getDate()}</span>
              {measurable && value != null && value > 0 && <small>{fmt(value)}</small>}
            </button>
          )
        })}
      </div>
      <div className="legend">
        <span><i className="history-cell done" /> Done</span>
        {measurable && <span><i className="history-cell partial" /> Partial</span>}
        <span><i className="history-cell skipped" /> Not done</span>
        <span><i className="history-cell rest" /> Not scheduled</span>
      </div>

      <section className="history-detail glass-item">
        <div className="panel-head">
          <strong>{formatLong(selected)}</strong>
          <span className="muted">
            {entry ? (entry.completed ? 'Done' : measurable && entry.value ? `${fmt(entry.value)} of ${fmt(habit.targetValue ?? 0)} ${habit.unit ?? ''}` : 'Marked not done') : 'No entry'}
          </span>
        </div>
        {measurable ? (
          <form
            className="measure-form"
            onSubmit={(event) => {
              event.preventDefault()
              const value = Number(draft)
              if (draft.trim() === '' || Number.isNaN(value) || value < 0) return
              void apply(app.setCheckIn(habit, { date: selected, value }))
            }}
          >
            <input type="number" inputMode="decimal" min={0} step="any" value={draft} placeholder="Amount" aria-label="Amount" onChange={(event) => setDraft(event.target.value)} />
            <span className="muted">{habit.unit ?? ''} / target {fmt(habit.targetValue ?? 0)}</span>
            <button type="submit" className="btn small primary" disabled={draft.trim() === ''}>Save</button>
            <button type="button" className="btn small ghost" onClick={() => void apply(app.setCheckIn(habit, { date: selected, completed: true }))}>Log full target</button>
          </form>
        ) : (
          <div className="history-actions">
            <button type="button" className={`btn small ${entry?.completed ? 'primary' : ''}`} onClick={() => void apply(app.setCheckIn(habit, { date: selected, completed: true }))}><Check size={15} /> Done</button>
            <button type="button" className={`btn small ${entry && !entry.completed ? 'primary' : ''}`} onClick={() => void apply(app.setCheckIn(habit, { date: selected, completed: false }))}><X size={15} /> Not done</button>
          </div>
        )}
        <button type="button" className="btn small ghost danger-text" disabled={!entry} onClick={() => void apply(app.clearCheckIn(habit, selected))}>
          <Eraser size={15} /> Clear entry
        </button>
      </section>
    </Modal>
  )
}

export function AddToRoutineDialog({ habit, app, onNewRoutine, onClose }: { habit: Habit; app: AppData; onNewRoutine: () => void; onClose: () => void }) {
  const [busy, setBusy] = useState<number | null>(null)

  const add = async (routine: Routine) => {
    setBusy(routine.id)
    const ok = await app.addHabitToRoutine(routine, habit)
    setBusy(null)
    if (ok) onClose()
  }

  return (
    <Modal title="Add to routine" onClose={onClose}>
      <p className="muted">Completing the step in the routine will check in <strong>{habit.name}</strong>.</p>
      {app.routines.length === 0 ? (
        <p className="muted">You have no routines yet.</p>
      ) : (
        <ul className="pick-list">
          {app.routines.map((routine) => {
            const linked = routine.steps.some((step) => step.habitId === habit.id)
            return (
              <li key={routine.id} className={`glass-item tone-${routine.color}`}>
                <span className="tile"><ListTodo size={18} /></span>
                <div className="grow">
                  <strong>{routine.name}</strong>
                  <small className="muted">{routine.steps.length} steps</small>
                </div>
                <button type="button" className="btn small" disabled={linked || busy !== null} onClick={() => void add(routine)}>
                  {linked ? 'Already added' : busy === routine.id ? 'Adding...' : 'Add'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <footer className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>Close</button>
        <button type="button" className="btn primary" onClick={onNewRoutine}><Plus size={15} /> New routine with this habit</button>
      </footer>
    </Modal>
  )
}

function CategoryRow({ category, app }: { category: Category; app: AppData }) {
  const [name, setName] = useState(category.name)
  const [confirming, setConfirming] = useState(false)

  const commit = () => {
    const next = name.trim()
    if (!next) setName(category.name)
    else if (next !== category.name) void app.updateCategory(category.id, next, category.color)
  }

  return (
    <li className="category-row glass-item">
      <div className="category-top">
        <i className={`dot big tone-${category.color}`} />
        <input
          value={name}
          maxLength={32}
          aria-label={`Rename ${category.name}`}
          onChange={(event) => setName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
        />
        <span className="muted">{category.habitCount} {category.habitCount === 1 ? 'habit' : 'habits'}</span>
        {confirming ? (
          <>
            <button type="button" className="btn small danger" onClick={() => void app.deleteCategory(category.id)}>Delete</button>
            <button type="button" className="icon-btn" aria-label="Cancel delete" onClick={() => setConfirming(false)}><X size={16} /></button>
          </>
        ) : (
          <button type="button" className="icon-btn" aria-label={`Delete ${category.name}`} onClick={() => setConfirming(true)}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {confirming && <small className="muted">Habits in this category are kept and become uncategorized.</small>}
      <ToneSwatches value={category.color} onChange={(tone) => void app.updateCategory(category.id, category.name, tone)} />
    </li>
  )
}

export function CategoryDialog({ app, onClose }: { app: AppData; onClose: () => void }) {
  const [name, setName] = useState('')
  const [tone, setTone] = useState<Tone>('violet')

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    const created = await app.createCategory(name.trim(), tone)
    if (created) setName('')
  }

  return (
    <Modal title="Categories" onClose={onClose}>
      <form className="form" onSubmit={add}>
        <div className="inline-card glass-item">
          <input value={name} maxLength={32} placeholder="New category name" aria-label="New category name" onChange={(event) => setName(event.target.value)} />
          <ToneSwatches value={tone} onChange={setTone} />
          <button type="submit" className="btn primary small" disabled={!name.trim()}><Plus size={15} /> Add category</button>
        </div>
      </form>
      <ul className="category-list">
        {app.categories.map((category) => <CategoryRow key={`${category.id}-${category.name}-${category.color}`} category={category} app={app} />)}
      </ul>
      {app.categories.length === 0 && <p className="muted center">No categories yet. Add your first one above.</p>}
    </Modal>
  )
}

interface StepDraft {
  key: number
  id?: number
  name: string
  habitId: number | null
}

export function RoutineDialog({ routine, seedHabit, app, onClose }: { routine: Routine | null; seedHabit?: Habit; app: AppData; onClose: () => void }) {
  const nextKey = useRef(100)
  const [name, setName] = useState(routine?.name ?? '')
  const [time, setTime] = useState(routine?.scheduledTime?.slice(0, 5) ?? '')
  const [tone, setTone] = useState<Tone>(routine?.color ?? 'amber')
  const [steps, setSteps] = useState<StepDraft[]>(() => {
    if (routine) return routine.steps.map((step, index) => ({ key: index, id: step.id, name: step.name, habitId: step.habitId }))
    if (seedHabit) return [{ key: 0, name: seedHabit.name, habitId: seedHabit.id }]
    return [{ key: 0, name: '', habitId: null }]
  })
  const [saving, setSaving] = useState(false)

  const habitsById = useMemo(() => new Map(app.habits.map((habit) => [habit.id, habit])), [app.habits])
  const linkedIds = new Set(steps.map((step) => step.habitId).filter((id): id is number => id !== null))
  const available = app.habits.filter((habit) => !habit.archived && !linkedIds.has(habit.id))
  const filled = steps.filter((step) => step.habitId !== null || step.name.trim())

  const addHabit = (id: number) => {
    const habit = habitsById.get(id)
    if (!habit) return
    setSteps((current) => {
      const withoutBlank = current.length === 1 && current[0].habitId === null && !current[0].name.trim() ? [] : current
      return [...withoutBlank, { key: nextKey.current++, name: habit.name, habitId: habit.id }]
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || filled.length === 0) return
    setSaving(true)
    const ok = await app.saveRoutine(routine?.id ?? null, {
      name: name.trim(),
      scheduledTime: time || null,
      color: tone,
      steps: filled.map((step) => (step.habitId !== null ? { id: step.id, habitId: step.habitId } : { id: step.id, name: step.name.trim() })),
    })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal title={routine ? 'Edit routine' : 'New routine'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="grid-2">
          <label className="field">
            <span>Name</span>
            <input autoFocus value={name} maxLength={80} placeholder="e.g. Morning reset" onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="field">
            <span>Time (optional)</span>
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
        </div>

        <div className="field">
          <span>Colour</span>
          <ToneSwatches value={tone} onChange={setTone} />
        </div>

        <div className="field">
          <span>Steps</span>
          <ul className="step-editor">
            {steps.map((step, index) => {
              const habit = step.habitId !== null ? habitsById.get(step.habitId) : undefined
              return (
                <li key={step.key} className={habit ? 'linked' : ''}>
                  {habit ? (
                    <div className="linked-step glass-item">
                      <HabitIcon icon={habit.icon} tone={habit.categoryColor} />
                      <div className="grow">
                        <strong>{habit.name}</strong>
                        <small className="muted"><Link2 size={12} /> Linked habit · {habit.goal}</small>
                      </div>
                    </div>
                  ) : (
                    <input
                      value={step.name}
                      maxLength={100}
                      placeholder={`Step ${index + 1}`}
                      aria-label={`Step ${index + 1}`}
                      onChange={(event) => setSteps((current) => current.map((item) => (item.key === step.key ? { ...item, name: event.target.value } : item)))}
                    />
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove step ${index + 1}`}
                    disabled={steps.length === 1}
                    onClick={() => setSteps((current) => current.filter((item) => item.key !== step.key))}
                  >
                    <X size={16} />
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="step-add">
            <button
              type="button"
              className="btn small ghost"
              disabled={steps.length >= 20}
              onClick={() => setSteps((current) => [...current, { key: nextKey.current++, name: '', habitId: null }])}
            >
              <Plus size={15} /> Add step
            </button>
            <select
              className="select"
              value=""
              aria-label="Add an existing habit as a step"
              disabled={steps.length >= 20 || available.length === 0}
              onChange={(event) => { if (event.target.value) addHabit(Number(event.target.value)) }}
            >
              <option value="">{available.length === 0 ? 'All habits added' : '+ Add existing habit...'}</option>
              {available.map((habit) => <option key={habit.id} value={habit.id}>{habit.name}</option>)}
            </select>
          </div>
          <small className="muted">Ticking a linked step checks in that habit for the day, and the other way round.</small>
        </div>

        <footer className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving || !name.trim() || filled.length === 0}>
            {saving ? 'Saving...' : routine ? 'Save changes' : 'Create routine'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="confirm-text">{message}</p>
      <footer className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn danger" autoFocus onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</button>
      </footer>
    </Modal>
  )
}

export { toKey }
