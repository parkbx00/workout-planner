import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { RepsInput, WeightInput } from '../components/SetInputs.tsx'
import {
  addSet,
  deleteSet,
  discardSession,
  loadWorkout,
  updateSession,
  updateSet,
  type Workout,
} from '../db/sessions.ts'
import type { Unit, WorkoutSet } from '../db/types.ts'
import { formatDuration } from '../lib/format.ts'
import { totalVolume } from '../lib/stats.ts'
import { convertWeight } from '../lib/units.ts'

/** A finished workout. Everything on it is editable and saves as you type. */
export default function SessionDetail() {
  const { id = '' } = useParams()
  const workout = useLiveQuery(async () => (await loadWorkout(id)) ?? null, [id])

  if (workout === undefined) return null
  if (workout === null) {
    return (
      <>
        <BackLink />
        <p className="text-muted mt-6">This workout no longer exists.</p>
      </>
    )
  }
  if (workout.session.endedAt === null) return <Navigate to="/workout" replace />
  return <Detail key={id} workout={workout} />
}

function BackLink() {
  return (
    <Link to="/history" className="text-accent -ml-2 flex min-h-11 w-fit items-center px-2">
      ‹ History
    </Link>
  )
}

/** Epoch ms → the "YYYY-MM-DDTHH:mm" local-time string a datetime-local input wants. */
function toLocalInput(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Detail({ workout }: { workout: Workout }) {
  const navigate = useNavigate()
  const { session, cards, unit } = workout
  const endedAt = session.endedAt!
  const [notes, setNotes] = useState(session.notes)
  const [minutes, setMinutes] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sets = cards.flatMap((c) => c.sets)
  const duration = endedAt - session.startedAt

  function changeStart(value: string) {
    const startedAt = new Date(value).getTime()
    if (Number.isNaN(startedAt)) return
    void updateSession(session.id, { startedAt, endedAt: startedAt + duration }) // keep the duration
  }

  function commitMinutes() {
    const n = Number(minutes)
    if (minutes !== null && minutes !== '' && n > 0 && n <= 24 * 60) {
      void updateSession(session.id, { endedAt: session.startedAt + n * 60_000 })
    }
    setMinutes(null)
  }

  async function remove() {
    await discardSession(session.id)
    navigate('/history')
  }

  const field = 'bg-surface-2 h-11 rounded-lg px-3 outline-none focus:ring-1 focus:ring-accent'

  return (
    <>
      <BackLink />
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        {workout.templateName ?? 'Workout'}
      </h1>
      <p className="text-muted mt-1">
        {new Date(session.startedAt).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
      <p className="text-muted mt-1 text-sm tabular-nums">
        {formatDuration(duration)} · {sets.length} {sets.length === 1 ? 'set' : 'sets'} ·{' '}
        {Math.round(totalVolume(sets, unit)).toLocaleString()} {unit}
      </p>

      <section className="bg-surface mt-5 space-y-3 rounded-2xl p-3">
        <label className="flex items-center justify-between gap-3">
          <span className="text-muted text-sm">Started</span>
          <input
            type="datetime-local"
            value={toLocalInput(session.startedAt)}
            onChange={(e) => changeStart(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-muted text-sm">Duration (minutes)</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            value={minutes ?? String(Math.round(duration / 60_000))}
            onFocus={(e) => {
              setMinutes(String(Math.round(duration / 60_000)))
              e.currentTarget.select()
            }}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onBlur={commitMinutes}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={`${field} w-24 text-center`}
          />
        </label>
        <label className="block">
          <span className="text-muted mb-1.5 block text-sm">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
              void updateSession(session.id, { notes: e.target.value })
            }}
            rows={2}
            placeholder="How did it go?"
            className="bg-surface-2 placeholder:text-muted focus:ring-accent w-full rounded-lg px-3 py-2 outline-none focus:ring-1"
          />
        </label>
      </section>

      <div className="mt-4 space-y-4">
        {cards.map(({ card, exercise, sets: cardSets }) => (
          <section key={card.id} className="bg-surface rounded-2xl p-3">
            <Link
              to={`/history/exercise/${card.exerciseId}`}
              className="flex min-h-11 items-center justify-between gap-2"
            >
              <h2 className="text-lg leading-tight font-bold">
                {exercise?.name ?? 'Unknown exercise'}
              </h2>
              <span className="text-muted shrink-0 text-sm">History ›</span>
            </Link>
            <div className="text-muted mt-1 grid grid-cols-[1.5rem_1fr_1fr_2.75rem] items-center gap-2 text-center text-xs">
              <span>Set</span>
              <span>{unit}</span>
              <span>Reps</span>
              <span />
            </div>
            <div className="mt-1 space-y-1.5">
              {cardSets.map((set, i) => (
                <EditRow key={set.id} set={set} index={i} unit={unit} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => void addSet(card.id, true)}
              className="text-accent mt-2 min-h-11 w-full rounded-lg text-sm font-semibold"
            >
              + Add set
            </button>
          </section>
        ))}
      </div>

      {cards.length === 0 && <p className="text-muted mt-4 text-sm">No sets left in this workout.</p>}

      <button
        type="button"
        onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
        onBlur={() => setConfirmDelete(false)}
        className={`mt-10 min-h-12 w-full rounded-xl font-medium ${
          confirmDelete ? 'bg-red-600 text-white' : 'bg-surface text-red-400'
        }`}
      >
        {confirmDelete ? 'Tap again to delete this workout' : 'Delete workout'}
      </button>
      <p className="text-muted mt-2 text-center text-sm">
        Edits save automatically and update your suggestions.
      </p>
    </>
  )
}

function EditRow({ set, index, unit }: { set: WorkoutSet; index: number; unit: Unit }) {
  const [confirm, setConfirm] = useState(false)
  const weight = set.weight === null ? null : convertWeight(set.weight, set.unit, unit)

  return (
    <div className="grid grid-cols-[1.5rem_1fr_1fr_2.75rem] items-center gap-2">
      <span className="text-muted text-center text-sm font-semibold">{index + 1}</span>
      <WeightInput
        label={`Set ${index + 1} weight`}
        value={weight}
        onChange={(value) => void updateSet(set.id, { weight: value, unit })}
        className="bg-surface-2"
      />
      <RepsInput
        label={`Set ${index + 1} reps`}
        value={set.reps}
        // A logged set always has reps; clearing the field leaves the old value until a new one is typed.
        onChange={(value) => value !== null && void updateSet(set.id, { reps: value })}
        className="bg-surface-2"
      />
      <button
        type="button"
        onClick={() => (confirm ? void deleteSet(set.id) : setConfirm(true))}
        onBlur={() => setConfirm(false)}
        aria-label={confirm ? `Confirm delete set ${index + 1}` : `Delete set ${index + 1}`}
        className={`flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold ${
          confirm ? 'bg-red-600 text-white' : 'text-muted'
        }`}
      >
        {confirm ? 'Del' : '✕'}
      </button>
    </div>
  )
}
