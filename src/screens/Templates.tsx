import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/db.ts'
import { createTemplate } from '../db/templates.ts'
import { DAY_LABEL } from '../lib/labels.ts'

export default function Templates() {
  const navigate = useNavigate()
  const data = useLiveQuery(async () => {
    const [templates, rows, exerciseCount] = await Promise.all([
      db.templates.orderBy('order').toArray(),
      db.templateExercises.toArray(),
      db.exercises.filter((e) => !e.archived).count(),
    ])
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.templateId, (counts.get(r.templateId) ?? 0) + 1)
    return { templates, counts, exerciseCount }
  }, [])

  async function addTemplate() {
    const template = await createTemplate()
    navigate(`/templates/edit/${template.id}`)
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Templates</h1>

      <ul className="mt-5 space-y-3">
        {data?.templates.map((t) => {
          const n = data.counts.get(t.id) ?? 0
          return (
            <li key={t.id}>
              <Link
                to={`/templates/edit/${t.id}`}
                className="bg-surface flex min-h-16 items-center justify-between gap-3 rounded-xl px-4 py-3"
              >
                <span>
                  <span className="block text-lg font-semibold">{t.name}</span>
                  <span className="text-muted text-sm">
                    {t.dayOfWeek === null ? 'No set day' : DAY_LABEL[t.dayOfWeek]} · {n}{' '}
                    {n === 1 ? 'exercise' : 'exercises'}
                  </span>
                </span>
                <span className="text-muted">›</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {data?.templates.length === 0 && (
        <p className="text-muted mt-2">No templates yet. Add one to plan a workout.</p>
      )}

      <button
        type="button"
        onClick={addTemplate}
        className="border-line text-accent mt-3 min-h-12 w-full rounded-xl border border-dashed font-semibold"
      >
        + New template
      </button>

      <Link
        to="/templates/exercises"
        className="bg-surface mt-8 flex min-h-14 items-center justify-between rounded-xl px-4"
      >
        <span className="font-medium">Exercise library</span>
        <span className="text-muted">{data?.exerciseCount ?? '…'} exercises ›</span>
      </Link>
    </>
  )
}
