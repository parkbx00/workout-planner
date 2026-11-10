import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useState } from 'react'
import { getWeeklyMuscleSets } from '../db/history.ts'
import { emptyMuscleCounts, shiftWeek, weekStart } from '../lib/charts.ts'

// Recharts is large; load it only when a chart is actually shown.
const MuscleBarChart = lazy(() => import('../components/charts/MuscleBarChart.tsx'))

/** Weekly working sets per muscle group, with week-by-week navigation. */
export default function Stats() {
  const weeks = useLiveQuery(getWeeklyMuscleSets, [])
  const [thisWeek] = useState(() => weekStart(Date.now()))
  const [week, setWeek] = useState(thisWeek)

  if (!weeks) return null
  if (weeks.size === 0) {
    return (
      <p className="text-muted mt-6 text-sm">
        Finish a workout and your weekly sets per muscle group will appear here.
      </p>
    )
  }

  const earliest = Math.min(...weeks.keys())
  const counts = weeks.get(week) ?? emptyMuscleCounts()
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const max = Math.max(...[...weeks.values()].flatMap((c) => Object.values(c)))
  const arrow =
    'text-accent flex h-11 w-11 items-center justify-center text-2xl disabled:opacity-30'
  const end = new Date(shiftWeek(week, 1) - 1)
  const range = `${new Date(week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  return (
    <section className="bg-surface mt-4 rounded-2xl p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeek((w) => shiftWeek(w, -1))}
          disabled={week <= earliest}
          aria-label="Previous week"
          className={arrow}
        >
          ‹
        </button>
        <div className="text-center">
          <div className="font-semibold">{week === thisWeek ? 'This week' : range}</div>
          <div className="text-muted text-sm">
            {week === thisWeek && `${range} · `}
            {total} {total === 1 ? 'set' : 'sets'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setWeek((w) => shiftWeek(w, 1))}
          disabled={week >= thisWeek}
          aria-label="Next week"
          className={arrow}
        >
          ›
        </button>
      </div>

      <h2 className="text-muted mt-3 mb-1 px-1 text-xs font-semibold tracking-wide uppercase">
        Working sets per muscle group
      </h2>
      <Suspense fallback={<div className="h-[328px]" />}>
        <MuscleBarChart counts={counts} max={max} />
      </Suspense>
      <p className="text-muted mt-2 px-1 text-xs">
        Every checked-off set counts. Weeks run Monday to Sunday.
      </p>
    </section>
  )
}
