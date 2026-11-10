import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getExerciseHistory } from '../db/history.ts'
import { exerciseTrend } from '../lib/charts.ts'
import { formatWeight } from '../lib/format.ts'
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../lib/labels.ts'
import { convertWeight } from '../lib/units.ts'

// Recharts is large; load it only when a chart is actually shown.
const TrendChart = lazy(() => import('../components/charts/TrendChart.tsx'))

/** Charts plus every logged set for one exercise, grouped by workout, newest first. */
export default function ExerciseHistory() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const data = useLiveQuery(() => getExerciseHistory(id), [id])
  const trend = useMemo(
    () =>
      data
        ? exerciseTrend(
            data.entries.map((e) => ({ startedAt: e.session.startedAt, sets: e.sets })),
            data.unit,
          )
        : [],
    [data],
  )
  if (!data) return null
  const { exercise, unit, entries } = data
  const best = Math.max(0, ...entries.map((e) => e.e1rm ?? 0))

  return (
    <>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-accent -ml-2 flex min-h-11 w-fit items-center px-2"
      >
        ‹ Back
      </button>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        {exercise?.name ?? 'Unknown exercise'}
      </h1>
      {exercise && (
        <p className="text-muted mt-1">
          {MUSCLE_LABEL[exercise.muscleGroup]} · {EQUIPMENT_LABEL[exercise.equipment]}
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-xl p-4">
          <dt className="text-muted text-sm">Sessions</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums">{entries.length}</dd>
        </div>
        <div className="bg-surface rounded-xl p-4">
          <dt className="text-muted text-sm">Best est. 1RM</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums">
            {best > 0 ? `${Math.round(best)} ${unit}` : '—'}
          </dd>
        </div>
      </dl>

      {trend.length >= 2 ? (
        <Suspense fallback={<div className="mt-4 h-[31rem]" />}>
          <div className="mt-4 space-y-3">
            <TrendChart
              title="Estimated 1RM"
              unit={unit}
              data={trend.map((p) => ({ t: p.t, value: p.e1rm }))}
            />
            <TrendChart
              title="Top set weight"
              unit={unit}
              data={trend.map((p) => ({ t: p.t, value: p.topWeight, detail: `× ${p.topReps}` }))}
            />
          </div>
        </Suspense>
      ) : (
        entries.length > 0 && (
          <p className="text-muted mt-4 text-sm">
            {trend.length === 0
              ? 'Charts track weight, so they need sets logged with a weight.'
              : 'Log this exercise in one more workout to see its trend charts.'}
          </p>
        )
      )}

      <h2 className="text-muted mt-6 mb-2 text-xs font-semibold tracking-wide uppercase">
        All sets
      </h2>
      {entries.length === 0 && <p className="text-muted text-sm">Nothing logged yet.</p>}
      <ul className="space-y-2">
        {entries.map(({ session, sets, e1rm }) => (
          <li key={session.id}>
            <Link
              to={`/history/session/${session.id}`}
              className="bg-surface block rounded-xl px-4 py-3"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold">
                  {new Date(session.startedAt).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-muted shrink-0 text-sm">
                  {e1rm !== null && `est. 1RM ${Math.round(e1rm)} `}›
                </span>
              </span>
              <span className="text-muted mt-1 block text-sm tabular-nums">
                {sets
                  .map((s) =>
                    s.weight
                      ? `${formatWeight(convertWeight(s.weight, s.unit, unit))} × ${s.reps}`
                      : `${s.reps} reps`,
                  )
                  .join('   ·   ')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
