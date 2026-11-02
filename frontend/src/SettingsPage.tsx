import { useEffect, useState, type FormEvent } from 'react'
import { Bell, BellOff, Check, Globe, Monitor, Moon, Sun, Tags } from 'lucide-react'
import { ACCENTS } from './catalog'
import type { ThemePref } from './hooks'
import { useUi } from './context'

const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function SettingsPage() {
  const ui = useUi()
  const { app, theme, reminders } = ui
  const [name, setName] = useState(app.profile?.name ?? '')

  useEffect(() => { if (app.profile) setName(app.profile.name) }, [app.profile])

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim() && name.trim() !== app.profile?.name) void app.saveName(name.trim())
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Make it yours</h1>
        </div>
      </header>

      <section className="glass panel">
        <h2>Profile</h2>
        <form className="form row" onSubmit={save}>
          <label className="field grow">
            <span>Your name</span>
            <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
          </label>
          <button type="submit" className="btn primary" disabled={!name.trim() || name.trim() === app.profile?.name}>Save</button>
        </form>
        <p className="muted inline"><Globe size={14} /> Time zone: {app.profile?.timeZone ?? '...'} (follows this device)</p>
      </section>

      <section className="glass panel">
        <h2>Appearance</h2>
        <div className="field">
          <span>Mode</span>
          <div className="theme-options" role="radiogroup" aria-label="Theme mode">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" role="radio" aria-checked={theme.pref === value} className={`theme-option ${theme.pref === value ? 'on' : ''}`} onClick={() => theme.choose(value)}>
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Colour theme</span>
          <div className="accent-grid" role="radiogroup" aria-label="Colour theme">
            {ACCENTS.map((accent) => (
              <button
                key={accent.key}
                type="button"
                role="radio"
                aria-checked={theme.accent === accent.key}
                className={`accent-option ${theme.accent === accent.key ? 'on' : ''}`}
                style={{ '--from': accent.from, '--to': accent.to } as React.CSSProperties}
                onClick={() => theme.chooseAccent(accent.key)}
              >
                <i className="accent-preview">{theme.accent === accent.key && <Check size={16} strokeWidth={3} />}</i>
                <span>{accent.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="glass panel">
        <h2>Reminders</h2>
        {reminders.permission === 'unsupported' ? (
          <p className="muted">This browser does not support notifications.</p>
        ) : reminders.permission === 'granted' ? (
          <p className="muted inline"><Bell size={14} /> Browser notifications are on. Reminders fire while Daymark is open in a tab.</p>
        ) : reminders.permission === 'denied' ? (
          <p className="muted inline"><BellOff size={14} /> Notifications are blocked. Allow them in your browser's site settings to receive reminders.</p>
        ) : (
          <div className="form row">
            <p className="muted grow">Get a notification at the time you set on each habit.</p>
            <button type="button" className="btn primary" onClick={() => void reminders.request()}><Bell size={16} /> Enable notifications</button>
          </div>
        )}
        <p className="muted">{reminders.due.length === 0 ? 'No reminders scheduled for today.' : `${reminders.due.length} reminder${reminders.due.length === 1 ? '' : 's'} today, ${reminders.upcoming.length} still to come.`}</p>
      </section>

      <section className="glass panel">
        <div className="panel-head">
          <h2>Categories</h2>
          <button type="button" className="btn ghost small" onClick={ui.manageCategories}><Tags size={15} /> Manage</button>
        </div>
        {app.categories.length === 0 ? (
          <p className="muted">No categories yet.</p>
        ) : (
          <div className="chips wrap">
            {app.categories.map((category) => (
              <span key={category.id} className={`chip static tone-${category.color}`}><i className="dot" /> {category.name} <small>{category.habitCount}</small></span>
            ))}
          </div>
        )}
      </section>

      <section className="glass panel">
        <h2>About</h2>
        <p className="muted">Daymark keeps your habits, routines and history in your local database. Sign-in is not part of this build yet.</p>
      </section>
    </div>
  )
}
