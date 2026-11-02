import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { MoreHorizontal, X, type LucideIcon } from 'lucide-react'
import type { Category, Habit, Tone } from './api'
import { ICONS } from './catalog'

export function HabitIcon({ icon, tone, small }: { icon: string; tone: Tone | null; small?: boolean }) {
  const Icon = ICONS[icon] ?? ICONS.target
  return (
    <span className={`tile tone-${tone ?? 'slate'} ${small ? 'small' : ''}`}>
      <Icon size={small ? 15 : 20} strokeWidth={2.2} />
    </span>
  )
}

export function Ring({ value, size = 56, tone, children }: { value: number; size?: number; tone?: Tone; children?: ReactNode }) {
  const style = { '--p': Math.round(Math.max(0, Math.min(1, value)) * 100), width: size, height: size } as CSSProperties
  return (
    <div className={`ring ${tone ? `tone-${tone}` : ''}`} style={style}>
      <span>{children}</span>
    </div>
  )
}

export function Empty({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon size={26} /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className={`modal glass-strong ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </header>
        {children}
      </div>
    </div>
  )
}

export interface MenuItem {
  label: string
  icon: LucideIcon
  danger?: boolean
  onSelect: () => void
}

export function RowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu-root" ref={root}>
      <button type="button" className="icon-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="popover menu glass-strong" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? 'danger' : ''}
              onClick={() => { setOpen(false); item.onSelect() }}
            >
              <item.icon size={16} /> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function CategoryChips({ categories, value, onChange }: { categories: Category[]; value: number | null; onChange: (id: number | null) => void }) {
  return (
    <div className="chips" role="tablist" aria-label="Filter by category">
      <button type="button" role="tab" aria-selected={value === null} className={`chip ${value === null ? 'on' : ''}`} onClick={() => onChange(null)}>
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          role="tab"
          aria-selected={value === category.id}
          className={`chip tone-${category.color} ${value === category.id ? 'on' : ''}`}
          onClick={() => onChange(value === category.id ? null : category.id)}
        >
          <i className="dot" /> {category.name}
        </button>
      ))}
    </div>
  )
}

export function matchesHabit(habit: Habit, search: string, categoryFilter: number | null) {
  if (categoryFilter !== null && habit.categoryId !== categoryFilter) return false
  const term = search.trim().toLowerCase()
  return !term || habit.name.toLowerCase().includes(term) || (habit.categoryName ?? '').toLowerCase().includes(term)
}
