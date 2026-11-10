import { useMemo, useState, type ReactNode } from 'react'
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../db/types.ts'
import { MUSCLE_LABEL } from '../lib/labels.ts'

/** Search box + muscle-group chips + exercises grouped by muscle. Rows are supplied by the caller. */
export default function ExerciseBrowser({
  exercises,
  emptyText,
  renderRow,
}: {
  exercises: Exercise[] | undefined
  emptyText: string
  renderRow: (exercise: Exercise) => ReactNode
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all')

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    const visible = (exercises ?? []).filter(
      (e) =>
        (group === 'all' || e.muscleGroup === group) && (!q || e.name.toLowerCase().includes(q)),
    )
    return MUSCLE_GROUPS.map((g) => ({
      group: g,
      items: visible.filter((e) => e.muscleGroup === g),
    })).filter((s) => s.items.length > 0)
  }, [exercises, query, group])

  return (
    <>
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

      {exercises && sections.length === 0 && (
        <p className="text-muted mt-8 text-center">{emptyText}</p>
      )}

      {sections.map((section) => (
        <section key={section.group} className="mt-5">
          <h2 className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">
            {MUSCLE_LABEL[section.group]} · {section.items.length}
          </h2>
          <ul className="bg-surface divide-line divide-y rounded-xl">
            {section.items.map((e) => (
              <li key={e.id}>{renderRow(e)}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
