import { CheckCheck, Clock, Link2, ListTodo, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useUi } from './context'
import { formatLong, formatTime } from './dates'
import { Empty, HabitIcon, RowMenu } from './ui'

export function RoutinesPage() {
  const ui = useUi()
  const { app } = ui
  const future = app.selectedDate > ui.today

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Routines</p>
          <h1>Daily flows</h1>
          <p className="muted">Showing progress for {formatLong(app.selectedDate)}. Steps linked to habits check them in for you.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn primary" onClick={() => ui.newRoutine()}><Plus size={16} /> New routine</button>
        </div>
      </header>

      {app.routines.length === 0 ? (
        <section className="glass panel">
          <Empty icon={ListTodo} title="No routines yet" text="Chain small steps or existing habits into a morning, work or evening flow.">
            <button type="button" className="btn primary small" onClick={() => ui.newRoutine()}><Plus size={15} /> Create a routine</button>
          </Empty>
        </section>
      ) : (
        <div className="cards">
          {app.routines.map((routine) => {
            const finished = routine.steps.filter((step) => step.completed).length
            const total = routine.steps.length
            const complete = total > 0 && finished === total
            return (
              <section key={routine.id} className={`glass panel routine-card tone-${routine.color}`}>
                <div className="panel-head">
                  <div className="routine-title">
                    <span className="tile"><ListTodo size={20} /></span>
                    <div>
                      <h2>{routine.name}</h2>
                      {routine.scheduledTime && <span className="muted inline"><Clock size={13} /> {formatTime(routine.scheduledTime)}</span>}
                    </div>
                  </div>
                  <RowMenu
                    label={`Options for ${routine.name}`}
                    items={[
                      { label: 'Edit', icon: Pencil, onSelect: () => ui.editRoutine(routine) },
                      { label: 'Delete', icon: Trash2, danger: true, onSelect: () => ui.deleteRoutine(routine) },
                    ]}
                  />
                </div>

                <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={finished}>
                  <span style={{ width: `${total ? (finished / total) * 100 : 0}%` }} />
                </div>
                <small className="muted">{finished} of {total} steps</small>

                <ul className="steps">
                  {routine.steps.map((step) => (
                    <li key={step.id}>
                      <label className={`step ${step.completed ? 'done' : ''} ${step.habitId ? 'linked' : ''}`}>
                        <input type="checkbox" checked={step.completed} disabled={future} onChange={() => app.toggleStep(routine, step.id)} />
                        {step.habitId && <HabitIcon icon={step.habitIcon ?? 'target'} tone={step.habitColor} small />}
                        <span>{step.name}</span>
                        {step.habitId && <Link2 size={13} className="muted" aria-label="Linked habit" />}
                      </label>
                    </li>
                  ))}
                </ul>

                <button type="button" className="btn ghost small" disabled={future} onClick={() => app.setRoutineDone(routine, !complete)}>
                  {complete ? <><RotateCcw size={15} /> Reset all</> : <><CheckCheck size={15} /> Mark all done</>}
                </button>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
