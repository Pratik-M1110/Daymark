// End-to-end API smoke test. Usage: node scripts/smoke-api.mjs [baseUrl]
const base = process.argv[2] ?? 'http://localhost:8080'

let failures = 0
const check = (label, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${condition ? '' : ` ${detail}`}`)
  if (!condition) failures++
}

async function call(method, path, body) {
  const response = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

const isoDate = (date) => date.toISOString().slice(0, 10)
const today = isoDate(new Date())
const tomorrow = isoDate(new Date(Date.now() + 86_400_000 * 2))
const suffix = Date.now().toString().slice(-6)
const everyDay = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

const health = await call('GET', '/api/health')
check('health endpoint', health.status === 200)

const profile = await call('GET', '/api/profile')
check('profile loads', profile.status === 200 && typeof profile.body.name === 'string')

const category = await call('POST', '/api/categories', { name: `Smoke ${suffix}`, color: 'teal' })
check('create category', category.status === 201 && category.body.color === 'teal', JSON.stringify(category.body))
const duplicate = await call('POST', '/api/categories', { name: `Smoke ${suffix}`, color: 'teal' })
check('duplicate category rejected', duplicate.status === 409)
const badColor = await call('POST', '/api/categories', { name: `Bad ${suffix}`, color: 'not-a-colour' })
check('invalid colour rejected', badColor.status === 400)

const habit = await call('POST', '/api/habits', {
  name: `Smoke habit ${suffix}`, categoryId: category.body.id, icon: 'flower', goal: '10 min', scheduledDays: everyDay,
})
check('create habit', habit.status === 201 && habit.body.categoryName === `Smoke ${suffix}`, JSON.stringify(habit.body))

const checkIn = await call('POST', `/api/habits/${habit.body.id}/check-ins`, { date: today, completed: true })
check('check in today', checkIn.status === 204)
const future = await call('POST', `/api/habits/${habit.body.id}/check-ins`, { date: tomorrow, completed: true })
check('future check-in rejected', future.status === 400)

const habits = await call('GET', `/api/habits?date=${today}`)
const listed = habits.body.find((item) => item.id === habit.body.id)
check('habit reports completion and streak', listed?.completed === true && listed.streak >= 1, JSON.stringify(listed))

const edited = await call('PUT', `/api/habits/${habit.body.id}`, {
  name: `Smoke renamed ${suffix}`, categoryId: null, icon: 'book', goal: 'Once', scheduledDays: ['MONDAY'], archived: false,
})
check('edit habit', edited.status === 200 && edited.body.name.startsWith('Smoke renamed') && edited.body.weeklyTarget === 1)
await call('PUT', `/api/habits/${habit.body.id}`, {
  name: `Smoke renamed ${suffix}`, categoryId: null, icon: 'book', goal: 'Once', scheduledDays: everyDay, archived: false,
})

const calendar = await call('GET', `/api/calendar?from=${today}&to=${today}`)
check('calendar counts the check-in', calendar.status === 200 && calendar.body[0].completed >= 1, JSON.stringify(calendar.body))
const tooWide = await call('GET', '/api/calendar?from=2020-01-01&to=2026-01-01')
check('oversized calendar range rejected', tooWide.status === 400)

const routine = await call('POST', '/api/routines', {
  name: `Smoke routine ${suffix}`, scheduledTime: '07:30:00', color: 'amber',
  steps: [{ name: 'Stretch' }, { name: 'Water' }],
})
check('create routine', routine.status === 201 && routine.body.steps.length === 2, JSON.stringify(routine.body))
const [first, second] = routine.body.steps
const stepDone = await call('PUT', `/api/routines/${routine.body.id}/steps/${first.id}/completion`, { date: today, completed: true })
check('complete routine step', stepDone.status === 204)
const afterStep = (await call('GET', `/api/routines?date=${today}`)).body.find((item) => item.id === routine.body.id)
check('step completion persisted', afterStep.steps[0].completed === true && afterStep.steps[1].completed === false)
const rename = await call('PUT', `/api/routines/${routine.body.id}`, {
  name: `Smoke routine ${suffix}`, scheduledTime: '07:30:00', color: 'sky', steps: [{ id: first.id, name: 'Stretch more' }, { id: second.id, name: 'Water' }],
})
check('routine edit keeps completions', rename.status === 200 && rename.body.color === 'sky')
const afterEdit = (await call('GET', `/api/routines?date=${today}`)).body.find((item) => item.id === routine.body.id)
check('completion survives edit', afterEdit.steps[0].completed === true)
const allDone = await call('PUT', `/api/routines/${routine.body.id}/completion`, { date: today, completed: true })
check('complete whole routine', allDone.status === 204)
const doneState = (await call('GET', `/api/routines?date=${today}`)).body.find((item) => item.id === routine.body.id)
check('all steps done', doneState.steps.every((step) => step.completed))
await call('PUT', `/api/routines/${routine.body.id}/completion`, { date: today, completed: false })

// Measurable habits, history editing, reminders and habit-linked routine steps
const yesterday = isoDate(new Date(Date.now() - 86_400_000))
const walk = await call('POST', '/api/habits', {
  name: `Smoke walk ${suffix}`, categoryId: null, icon: 'footprints', scheduledDays: everyDay,
  trackType: 'MEASURABLE', targetValue: 4, unit: 'km',
  reminders: [
    { time: '07:00:00', repeat: 'HABIT_DAYS', days: [], intervalDays: null, message: 'Lace up', enabled: true },
    { time: '18:30:00', repeat: 'EVERY_N_DAYS', days: [], intervalDays: 2, message: null, enabled: true },
  ],
})
check('create measurable habit', walk.status === 201 && walk.body.trackType === 'MEASURABLE' && walk.body.goal === '4 km' && walk.body.reminders.length === 2, JSON.stringify(walk.body))
const noTarget = await call('POST', '/api/habits', { name: `Bad walk ${suffix}`, scheduledDays: everyDay, trackType: 'MEASURABLE', unit: 'km' })
check('measurable without target rejected', noTarget.status === 400)
const badReminder = await call('POST', '/api/habits', {
  name: `Bad reminder ${suffix}`, scheduledDays: everyDay, reminders: [{ time: '07:00:00', repeat: 'CUSTOM_DAYS', days: [], enabled: true }],
})
check('custom-day reminder without days rejected', badReminder.status === 400)

check('log partial value', (await call('POST', `/api/habits/${walk.body.id}/check-ins`, { date: today, value: 3 })).status === 204)
let walkState = (await call('GET', `/api/habits?date=${today}`)).body.find((item) => item.id === walk.body.id)
check('partial value is not complete', walkState?.completed === false && Number(walkState.value) === 3, JSON.stringify(walkState))
check('log target value', (await call('POST', `/api/habits/${walk.body.id}/check-ins`, { date: today, value: 4.5 })).status === 204)
walkState = (await call('GET', `/api/habits?date=${today}`)).body.find((item) => item.id === walk.body.id)
check('reaching target completes habit', walkState?.completed === true && walkState.streak >= 1)

check('backfill yesterday', (await call('POST', `/api/habits/${walk.body.id}/check-ins`, { date: yesterday, value: 5 })).status === 204)
const history = await call('GET', `/api/habits/${walk.body.id}/check-ins?from=${yesterday}&to=${today}`)
check('history lists both days', history.status === 200 && history.body.length === 2 && history.body.every((entry) => entry.completed), JSON.stringify(history.body))
check('delete history entry', (await call('DELETE', `/api/habits/${walk.body.id}/check-ins/${yesterday}`)).status === 204)
const afterDelete = await call('GET', `/api/habits/${walk.body.id}/check-ins?from=${yesterday}&to=${today}`)
check('history entry removed', afterDelete.body.length === 1 && afterDelete.body[0].date === today)

const due = await call('GET', `/api/reminders?date=${today}`)
check('reminders due today include habit', due.status === 200 && due.body.some((item) => item.habitId === walk.body.id && item.time === '07:00:00'), JSON.stringify(due.body))

const linked = await call('POST', '/api/routines', {
  name: `Smoke linked ${suffix}`, scheduledTime: null, color: 'emerald',
  steps: [{ habitId: habit.body.id }, { name: 'Plain step' }],
})
check('routine with linked habit step', linked.status === 201 && linked.body.steps[0].habitId === habit.body.id && linked.body.steps[0].name.startsWith('Smoke renamed'), JSON.stringify(linked.body))
const dupLink = await call('POST', '/api/routines', { name: `Dup ${suffix}`, color: 'emerald', steps: [{ habitId: habit.body.id }, { habitId: habit.body.id }] })
check('duplicate linked habit rejected', dupLink.status === 400)
await call('POST', `/api/habits/${habit.body.id}/check-ins`, { date: today, completed: false })
const linkedStep = linked.body.steps[0]
check('complete linked step', (await call('PUT', `/api/routines/${linked.body.id}/steps/${linkedStep.id}/completion`, { date: today, completed: true })).status === 204)
const habitAfterStep = (await call('GET', `/api/habits?date=${today}`)).body.find((item) => item.id === habit.body.id)
check('linked step checks habit in', habitAfterStep?.completed === true)
await call('POST', `/api/habits/${habit.body.id}/check-ins`, { date: today, completed: false })
const routineAfterHabit = (await call('GET', `/api/routines?date=${today}`)).body.find((item) => item.id === linked.body.id)
check('habit state reflects into routine step', routineAfterHabit.steps[0].completed === false)
check('delete linked routine', (await call('DELETE', `/api/routines/${linked.body.id}`)).status === 204)
check('delete measurable habit', (await call('DELETE', `/api/habits/${walk.body.id}`)).status === 204)

const insights = await call('GET', '/api/insights')
check('insights load', insights.status === 200 && insights.body.week.length === 7 && insights.body.activeHabits >= 1, JSON.stringify(insights.body).slice(0, 200))

const profileUpdate = await call('PUT', '/api/profile', { name: profile.body.name, timeZone: profile.body.timeZone })
check('profile update', profileUpdate.status === 200)
const badZone = await call('PUT', '/api/profile', { name: 'x', timeZone: 'Mars/Base' })
check('invalid time zone rejected', badZone.status === 400)

check('delete routine', (await call('DELETE', `/api/routines/${routine.body.id}`)).status === 204)
check('delete habit', (await call('DELETE', `/api/habits/${habit.body.id}`)).status === 204)
check('delete category', (await call('DELETE', `/api/categories/${category.body.id}`)).status === 204)

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
