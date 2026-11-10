import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { getSessionSummary } from '../db/sessions.ts'
import { formatDuration, formatWeight } from '../lib/format.ts'
import { convertWeight } from '../lib/units.ts'

export default function WorkoutSummary() {
  const { id = '' } = useParams()
  const summary = useLiveQuery(async () => (await getSessionSummary(id)) ?? null, [id])

  if (summary === undefined) return null
  if (summary === null) {
    return (
      <Link to="/" className="text-accent flex min-h-11 items-center">
        ‹ Today
      </Link>
    )
  }
  const { unit } = summary

  return (
    <>
      <p className="text-accent text-sm font-semibold">Workout complete</p>
      <h1 className="text-3xl font-bold tracking-tight">{summary.templateName ?? 'Workout'}</h1>
      <p className="text-muted mt-1">
        {new Date(summary.session.startedAt).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3">
        <Stat label="Duration" value={formatDuration(summary.durationMs)} />
        <Stat
          label="Total volume"
          value={`${Math.round(summary.volume).toLocaleString()} ${unit}`}
        />
        <Stat label="Sets" value={String(summary.setCount)} />
        <Stat label="Exercises" value={String(summary.exerciseCount)} />
      </dl>

      <h2 className="text-muted mt-8 mb-2 text-xs font-semibold tracking-wide uppercase">
        Personal records · {summary.prs.length}
      </h2>
      {summary.prs.length === 0 ? (
        <p className="text-muted text-sm">
          None this time. A PR is a new best estimated 1RM for an exercise you've logged before.
        </p>
      ) : (
        <ul className="bg-surface divide-line divide-y rounded-xl">
          {summary.prs.map(({ exercise, set, e1rm }) => (
            <li key={set.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
              <span className="font-medium">🏆 {exercise?.name ?? 'Unknown exercise'}</span>
              <span className="text-muted shrink-0 text-right text-sm">
                {formatWeight(convertWeight(set.weight ?? 0, set.unit, unit))} {unit} × {set.reps}
                <br />
                est. 1RM {Math.round(e1rm)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/"
        className="bg-accent text-accent-ink mt-8 flex min-h-14 items-center justify-center rounded-xl text-lg font-bold"
      >
        Done
      </Link>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-xl p-4">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  )
}
