import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Sheet, { SheetButton } from '../components/Sheet.tsx'
import {
  addSet,
  discardSession,
  finishSession,
  getActiveSession,
  loadWorkout,
  moveSessionExercise,
  removeLastSet,
  removeSessionExercise,
  setCompleted,
  updateSet,
  type Workout as WorkoutData,
  type WorkoutCard,
} from '../db/sessions.ts'
import type { Unit, WorkoutSet } from '../db/types.ts'
import { formatClock, formatDuration, formatWeight } from '../lib/format.ts'
import { EQUIPMENT_LABEL } from '../lib/labels.ts'
import { restTimer } from '../lib/restTimer.ts'
import { convertWeight } from '../lib/units.ts'

export default function Workout() {
  // undefined = loading, null = no workout in progress
  const workout = useLiveQuery(async () => {
    const active = await getActiveSession()
    return active ? loadWorkout(active.id) : null
  }, [])

  if (workout === undefined) return null
  if (workout === null) {
    return (
      <>
        <h1 className="text-3xl font-bold tracking-tight">Workout</h1>
        <p className="text-muted mt-3">No workout in progress.</p>
        <Link
          to="/"
          className="bg-accent text-accent-ink mt-6 flex min-h-14 items-center justify-center rounded-xl text-lg font-bold"
        >
          Go to Today
        </Link>
      </>
    )
  }
  return <ActiveWorkout workout={workout} />
}

function ActiveWorkout({ workout }: { workout: WorkoutData }) {
  const navigate = useNavigate()
  const [finishing, setFinishing] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const { session, cards, unit } = workout

  const allSets = cards.flatMap((c) => c.sets)
  const doneCount = allSets.filter((s) => s.completed).length

  async function finish() {
    restTimer.clear()
    const saved = await finishSession(session.id)
    navigate(saved ? `/workout/summary/${session.id}` : '/', { replace: true })
  }

  async function discard() {
    restTimer.clear()
    await discardSession(session.id)
    navigate('/', { replace: true })
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {workout.templateName ?? 'Workout'}
          </h1>
          <p className="text-muted text-sm tabular-nums">
            <Elapsed since={session.startedAt} /> · {doneCount}/{allSets.length} sets
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setConfirmDiscard(false)
            setFinishing(true)
          }}
          className="bg-accent text-accent-ink min-h-11 shrink-0 rounded-xl px-5 font-bold"
        >
          Finish
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {cards.map((c, i) => (
          <Card
            key={c.card.id}
            data={c}
            unit={unit}
            isFirst={i === 0}
            isLast={i === cards.length - 1}
          />
        ))}
      </div>

      {cards.length === 0 && (
        <p className="text-muted mt-2">Nothing here yet. Add your first exercise.</p>
      )}

      <Link
        to="/workout/add"
        className="border-line text-accent mt-4 flex min-h-13 items-center justify-center rounded-xl border border-dashed font-semibold"
      >
        + Add exercise
      </Link>

      {finishing && (
        <Sheet
          title={doneCount > 0 ? 'Finish workout?' : 'Nothing logged yet'}
          onClose={() => setFinishing(false)}
        >
          <p className="text-muted pb-1 text-sm">
            {doneCount === 0
              ? 'No sets are checked off, so there is nothing to save.'
              : doneCount === allSets.length
                ? `All ${doneCount} sets are checked off.`
                : `${doneCount} of ${allSets.length} sets are checked off. The ${
                    allSets.length - doneCount
                  } unchecked won't be saved.`}
          </p>
          {doneCount > 0 && (
            <SheetButton tone="primary" onClick={() => void finish()}>
              Finish and save
            </SheetButton>
          )}
          <SheetButton onClick={() => setFinishing(false)}>Keep going</SheetButton>
          <SheetButton
            tone="danger"
            onClick={() => (confirmDiscard ? void discard() : setConfirmDiscard(true))}
          >
            {confirmDiscard ? 'Tap again to discard everything' : 'Discard workout'}
          </SheetButton>
        </Sheet>
      )}
    </>
  )
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return <>{formatDuration(now - since)}</>
}

function Card({
  data,
  unit,
  isFirst,
  isLast,
}: {
  data: WorkoutCard
  unit: Unit
  isFirst: boolean
  isLast: boolean
}) {
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const { card, exercise, sets, previous } = data
  const name = exercise?.name ?? 'Unknown exercise'
  const hasLogged = sets.some((s) => s.completed)

  const act = (fn: () => Promise<void>) => {
    setMenu(false)
    void fn()
  }

  return (
    <section className="bg-surface rounded-2xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-bold">{name}</h2>
          <p className="text-muted mt-0.5 text-sm">
            Target {card.targetSets} × {card.repMin}–{card.repMax} · Rest{' '}
            {formatClock(card.restSeconds)}
            {exercise && ` · ${EQUIPMENT_LABEL[exercise.equipment]}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setConfirmRemove(false)
            setMenu(true)
          }}
          aria-label={`Options for ${name}`}
          className="text-muted -mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center text-2xl"
        >
          ⋯
        </button>
      </div>

      <div className="text-muted mt-2 grid grid-cols-[1.5rem_1fr_4.75rem_4rem_2.75rem] items-center gap-2 text-center text-xs">
        <span>Set</span>
        <span>Previous</span>
        <span>{unit}</span>
        <span>Reps</span>
        <span />
      </div>
      <div className="mt-1 space-y-1.5">
        {sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            index={i}
            ghost={previous[i]}
            restSeconds={card.restSeconds}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => void addSet(card.id)}
        className="text-accent mt-2 min-h-11 w-full rounded-lg text-sm font-semibold"
      >
        + Add set
      </button>

      {menu && (
        <Sheet title={name} onClose={() => setMenu(false)}>
          <SheetButton
            onClick={() => {
              setMenu(false)
              navigate(`/workout/swap/${card.id}`)
            }}
          >
            Swap exercise
          </SheetButton>
          <SheetButton onClick={() => act(() => addSet(card.id))}>Add set</SheetButton>
          <SheetButton disabled={sets.length === 0} onClick={() => act(() => removeLastSet(card.id))}>
            Remove last set
          </SheetButton>
          <SheetButton disabled={isFirst} onClick={() => act(() => moveSessionExercise(card.id, -1))}>
            Move up
          </SheetButton>
          <SheetButton disabled={isLast} onClick={() => act(() => moveSessionExercise(card.id, 1))}>
            Move down
          </SheetButton>
          <SheetButton
            tone="danger"
            onClick={() =>
              hasLogged && !confirmRemove
                ? setConfirmRemove(true)
                : act(() => removeSessionExercise(card.id))
            }
          >
            {confirmRemove ? 'Tap again: this deletes its logged sets' : 'Remove exercise'}
          </SheetButton>
        </Sheet>
      )}
    </section>
  )
}

const parseNumber = (text: string) => (text === '' || text === '.' ? null : Number(text))

function SetRow({
  set,
  index,
  ghost,
  restSeconds,
}: {
  set: WorkoutSet
  index: number
  ghost: WorkoutSet | undefined
  restSeconds: number
}) {
  // While a field has focus its raw text lives here (so "12." survives); every keystroke is still saved.
  const [weightText, setWeightText] = useState<string | null>(null)
  const [repsText, setRepsText] = useState<string | null>(null)
  const [needsReps, setNeedsReps] = useState(false)

  const ghostWeight =
    ghost && ghost.weight !== null ? convertWeight(ghost.weight, ghost.unit, set.unit) : null

  function toggle() {
    if (set.completed) return void setCompleted(set.id, false)
    if (set.reps === null) {
      setNeedsReps(true)
      setTimeout(() => setNeedsReps(false), 1200)
      return
    }
    // Started inside the tap handler so iOS allows the end-of-rest sound.
    if (restSeconds > 0) restTimer.start(restSeconds)
    void setCompleted(set.id, true)
  }

  const input =
    'h-11 w-full rounded-lg text-center text-lg font-semibold tabular-nums outline-none focus:ring-1 focus:ring-accent'
  const tint = set.completed ? 'bg-accent/15 text-accent' : 'bg-surface-2'

  return (
    <div className="grid grid-cols-[1.5rem_1fr_4.75rem_4rem_2.75rem] items-center gap-2">
      <span className="text-muted text-center text-sm font-semibold">{index + 1}</span>

      <button
        type="button"
        disabled={!ghost}
        onClick={() => void updateSet(set.id, { weight: ghostWeight, reps: ghost?.reps ?? null })}
        aria-label={ghost ? `Copy previous set ${index + 1}` : undefined}
        className="text-muted h-11 truncate rounded-lg text-center text-sm tabular-nums"
      >
        {ghost
          ? `${ghostWeight === null ? '–' : formatWeight(ghostWeight)} × ${ghost.reps ?? '–'}`
          : '—'}
      </button>

      <input
        inputMode="decimal"
        enterKeyHint="done"
        aria-label={`Set ${index + 1} weight`}
        value={weightText ?? (set.weight === null ? '' : formatWeight(set.weight))}
        onFocus={(e) => {
          setWeightText(set.weight === null ? '' : formatWeight(set.weight))
          e.currentTarget.select()
        }}
        onChange={(e) => {
          const text = e.target.value
            .replace(',', '.')
            .replace(/[^\d.]/g, '')
            .replace(/(\..*)\./g, '$1')
            .slice(0, 6)
          setWeightText(text)
          void updateSet(set.id, { weight: parseNumber(text) })
        }}
        onBlur={() => setWeightText(null)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={`${input} ${tint}`}
      />

      <input
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        aria-label={`Set ${index + 1} reps`}
        value={repsText ?? (set.reps === null ? '' : String(set.reps))}
        onFocus={(e) => {
          setRepsText(set.reps === null ? '' : String(set.reps))
          e.currentTarget.select()
        }}
        onChange={(e) => {
          const text = e.target.value.replace(/\D/g, '').slice(0, 3)
          setRepsText(text)
          void updateSet(set.id, { reps: parseNumber(text) })
        }}
        onBlur={() => setRepsText(null)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={`${input} ${tint} ${needsReps ? 'ring-2 ring-red-500' : ''}`}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={`Set ${index + 1} done`}
        aria-pressed={set.completed}
        className={`flex h-11 w-11 items-center justify-center rounded-lg text-xl font-bold ${
          set.completed ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'
        }`}
      >
        ✓
      </button>
    </div>
  )
}
