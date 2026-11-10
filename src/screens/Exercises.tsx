import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/db.ts'
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../db/types.ts'
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../lib/labels.ts'

export default function Exercises() {
  const all = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all')
  const [showArchived, setShowArchived] = useState(false)

  const archivedCount = all?.filter((e) => e.archived).length ?? 0

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    const visible = (all ?? []).filter(
      (e) =>
        e.archived === showArchived &&
        (group === 'all' || e.muscleGroup === group) &&
        (!q || e.name.toLowerCase().includes(q)),
    )
    return MUSCLE_GROUPS.map((g) => ({
      group: g,
      items: visible.filter((e) => e.muscleGroup === g),
    })).filter((s) => s.items.length > 0)
  }, [all, query, group, showArchived])

  return (
    <>
      <div className="flex items-center justify-between">
        <Link to="/templates" className="text-accent -ml-2 flex min-h-11 items-center px-2">
          ‹ Templates
        </Link>
        <Link
          to="/templates/exercises/new"
          className="bg-accent text-accent-ink flex min-h-11 items-center rounded-xl px-4 font-semibold"
        >
          + New
        </Link>
      </div>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        {showArchived ? 'Archived exercises' : 'Exercises'}
      </h1>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        aria-label="Search exercises"
        className="bg-surface placeholder:text-muted mt-4 h-12 w-full rounded-xl px-4 outline-none"
      />

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {(['all', ...MUSCLE_GROUPS] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            aria-pressed={group === g}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium ${
              group === g ? 'bg-accent text-accent-ink' : 'bg-surface text-muted'
            }`}
          >
            {g === 'all' ? 'All' : MUSCLE_LABEL[g]}
          </button>
        ))}
      </div>

      {all && sections.length === 0 && (
        <p className="text-muted mt-8 text-center">
          {showArchived ? 'No archived exercises.' : 'No exercises match.'}
        </p>
      )}

      {sections.map((section) => (
        <section key={section.group} className="mt-5">
          <h2 className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">
            {MUSCLE_LABEL[section.group]} · {section.items.length}
          </h2>
          <ul className="bg-surface divide-line divide-y rounded-xl">
            {section.items.map((e) => (
              <ExerciseRow key={e.id} exercise={e} />
            ))}
          </ul>
        </section>
      ))}

      {(archivedCount > 0 || showArchived) && (
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="text-muted mt-6 min-h-11 w-full text-sm underline"
        >
          {showArchived ? 'Back to active exercises' : `Show archived (${archivedCount})`}
        </button>
      )}
    </>
  )
}

function ExerciseRow({ exercise }: { exercise: Exercise }) {
  return (
    <li>
      <Link
        to={`/templates/exercises/${exercise.id}`}
        className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
      >
        <span className="font-medium">
          {exercise.name}
          {exercise.isCustom && (
            <span className="text-accent ml-2 text-xs font-semibold">Custom</span>
          )}
        </span>
        <span className="text-muted shrink-0 text-sm">{EQUIPMENT_LABEL[exercise.equipment]} ›</span>
      </Link>
    </li>
  )
}
