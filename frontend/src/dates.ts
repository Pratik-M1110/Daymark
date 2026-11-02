export const DAYS = [
  { key: 'MONDAY', short: 'Mon', letter: 'M' },
  { key: 'TUESDAY', short: 'Tue', letter: 'T' },
  { key: 'WEDNESDAY', short: 'Wed', letter: 'W' },
  { key: 'THURSDAY', short: 'Thu', letter: 'T' },
  { key: 'FRIDAY', short: 'Fri', letter: 'F' },
  { key: 'SATURDAY', short: 'Sat', letter: 'S' },
  { key: 'SUNDAY', short: 'Sun', letter: 'S' },
] as const

export const toKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const fromKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const todayKey = () => toKey(new Date())

export const addDays = (key: string, amount: number) => {
  const date = fromKey(key)
  date.setDate(date.getDate() + amount)
  return toKey(date)
}

/** Weeks start on Monday. */
export const startOfWeek = (key: string) => addDays(key, -((fromKey(key).getDay() + 6) % 7))

export const weekKeys = (key: string) => {
  const start = startOfWeek(key)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export const monthGrid = (year: number, month: number) => {
  const start = startOfWeek(toKey(new Date(year, month, 1)))
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export const weekdayKey = (key: string) => DAYS[(fromKey(key).getDay() + 6) % 7].key

export const formatLong = (key: string) =>
  fromKey(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

export const formatShort = (key: string) =>
  fromKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export const formatMonth = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

export const formatTime = (time: string | null) => (time ? time.slice(0, 5) : '')
