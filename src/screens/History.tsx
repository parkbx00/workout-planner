import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { listLoggedExercises, listSessions, type SessionListItem } from '../db/history.ts'
import type { Unit } from '../db/types.ts'
import { MUSCLE_LABEL } from '../lib/labels.ts'
import Stats from './Stats.tsx'

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export default function History() {
  const { pathname } = useLocation()
  const view = pathname.endsWith('/exercises')
    ? 'exercises'
    : pathname.endsWith('/stats')
      ? 'stats'
      : 'workouts'
  const tab = (active: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${
      active ? 'bg-surface-2 text-text' : 'text-muted'
    }`

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">History</h1>
      <div className="bg-surface mt-4 flex rounded-xl p-1">
        <Link to="/history" replace className={tab(view === 'workouts')}>
          Workouts
        </Link>
        <Link to="/history/exercises" replace className={tab(view === 'exercises')}>
          Exercises
        </Link>
        <Link to="/history/stats" replace className={tab(view === 'stats')}>
          Weekly sets
        </Link>
      </div>
      {view === 'exercises' ? <ExerciseList /> : view === 'stats' ? <Stats /> : <SessionList />}
    </>
  )
}

function SessionList() {
  const data = useLiveQuery(listSessions, [])
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const map = new Map<string, SessionListItem[]>()
    for (const item of data?.items ?? []) {
      const key = dayKey(new Date(item.session.startedAt))
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }, [data])

  if (!data) return null

  const inMonth = data.items.filter((i) => {
    const d = new Date(i.session.startedAt)
    return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()
  })
  const shown = selectedDay ? (byDay.get(selectedDay) ?? []) : inMonth

  function shiftMonth(delta: number) {
    setSelectedDay(null)
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  return (
    <>
      <Calendar
        month={month}
        hasWorkout={(key) => byDay.has(key)}
        selectedDay={selectedDay}
        onSelect={(key) => setSelectedDay((cur) => (cur === key ? null : key))}
        onShift={shiftMonth}
      />

      <h2 className="text-muted mt-6 mb-2 text-xs font-semibold tracking-wide uppercase">
        {selectedDay
          ? 'Selected day'
          : month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}{' '}
        · {shown.length} {shown.length === 1 ? 'workout' : 'workouts'}
      </h2>

      {shown.length === 0 ? (
        <p className="text-muted text-sm">
          {data.items.length === 0
            ? 'No workouts logged yet. Finish one and it will appear here.'
            : 'No workouts here.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((item) => (
            <SessionRow key={item.session.id} item={item} unit={data.unit} />
          ))}
        </ul>
      )}
    </>
  )
}

function SessionRow({ item, unit }: { item: SessionListItem; unit: Unit }) {
  const started = new Date(item.session.startedAt)
  return (
    <li>
      <Link
        to={`/history/session/${item.session.id}`}
        className="bg-surface flex min-h-16 items-center justify-between gap-3 rounded-xl px-4 py-3"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{item.templateName ?? 'Workout'}</span>
          <span className="text-muted text-sm">
            {started.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}{' '}
            · {Math.max(1, Math.round(item.durationMs / 60_000))} min
          </span>
        </span>
        <span className="text-muted shrink-0 text-right text-sm">
          {item.setCount} {item.setCount === 1 ? 'set' : 'sets'}
          <br />
          {Math.round(item.volume).toLocaleString()} {unit} ›
        </span>
      </Link>
    </li>
  )
}

function Calendar({
  month,
  hasWorkout,
  selectedDay,
  onSelect,
  onShift,
}: {
  month: Date
  hasWorkout: (key: string) => boolean
  selectedDay: string | null
  onSelect: (key: string) => void
  onShift: (delta: number) => void
}) {
  const [todayKey] = useState(() => dayKey(new Date()))
  const year = month.getFullYear()
  const m = month.getMonth()
  const leading = new Date(year, m, 1).getDay()
  const days = new Date(year, m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ]
  const arrow = 'text-accent flex h-11 w-11 items-center justify-center text-2xl'

  return (
    <section className="bg-surface mt-4 rounded-2xl p-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onShift(-1)} aria-label="Previous month" className={arrow}>
          ‹
        </button>
        <span className="font-semibold">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={() => onShift(1)} aria-label="Next month" className={arrow}>
          ›
        </button>
      </div>
      <div className="text-muted mt-1 grid grid-cols-7 text-center text-xs">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={i} />
          const key = `${year}-${m}-${day}`
          const worked = hasWorkout(key)
          const selected = selectedDay === key
          return (
            <button
              key={i}
              type="button"
              disabled={!worked}
              onClick={() => onSelect(key)}
              aria-label={worked ? `${day}, workout logged` : String(day)}
              aria-pressed={selected}
              className="flex h-11 items-center justify-center"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm tabular-nums ${
                  selected
                    ? 'bg-accent text-accent-ink font-bold'
                    : worked
                      ? 'bg-accent/20 text-accent font-bold'
                      : key === todayKey
                        ? 'ring-line text-text ring-1'
                        : 'text-muted'
                }`}
              >
                {day}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ExerciseList() {
  const logged = useLiveQuery(listLoggedExercises, [])
  if (!logged) return null
  if (logged.length === 0) {
    return <p className="text-muted mt-6 text-sm">Exercises you log will appear here.</p>
  }
  return (
    <ul className="bg-surface divide-line mt-4 divide-y rounded-xl">
      {logged.map(({ exercise, sessionCount, lastAt }) => (
        <li key={exercise.id}>
          <Link
            to={`/history/exercise/${exercise.id}`}
            className="flex min-h-16 items-center justify-between gap-3 px-4 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{exercise.name}</span>
              <span className="text-muted text-sm">{MUSCLE_LABEL[exercise.muscleGroup]}</span>
            </span>
            <span className="text-muted shrink-0 text-right text-sm">
              {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
              <br />
              last {new Date(lastAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
