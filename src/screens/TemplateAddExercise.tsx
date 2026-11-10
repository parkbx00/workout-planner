import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import ExerciseBrowser from '../components/ExerciseBrowser.tsx'
import { db } from '../db/db.ts'
import { addTemplateExercise, listTemplateExercises } from '../db/templates.ts'
import { EQUIPMENT_LABEL } from '../lib/labels.ts'

/** Tap exercises to add them to the template; stays open so several can be added in one visit. */
export default function TemplateAddExercise() {
  const { id = '' } = useParams()
  const data = useLiveQuery(async () => {
    const [template, exercises, rows] = await Promise.all([
      db.templates.get(id),
      db.exercises.orderBy('name').toArray(),
      listTemplateExercises(id),
    ])
    return {
      template,
      exercises: exercises.filter((e) => !e.archived),
      added: new Set(rows.map((r) => r.exerciseId)),
    }
  }, [id])

  const back = `/templates/edit/${id}`

  return (
    <>
      <div className="flex items-center justify-between">
        <Link to={back} className="text-accent -ml-2 flex min-h-11 items-center px-2">
          ‹ {data?.template?.name ?? 'Template'}
        </Link>
        <Link
          to={back}
          className="bg-accent text-accent-ink flex min-h-11 items-center rounded-xl px-4 font-semibold"
        >
          Done
        </Link>
      </div>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Add exercises</h1>

      <ExerciseBrowser
        exercises={data?.exercises}
        emptyText="No exercises match."
        renderRow={(e) => {
          const added = data!.added.has(e.id)
          return (
            <button
              type="button"
              disabled={added}
              onClick={() => void addTemplateExercise(id, e.id)}
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left"
            >
              <span className={`font-medium ${added ? 'text-muted' : ''}`}>{e.name}</span>
              <span className={`shrink-0 text-sm ${added ? 'text-accent' : 'text-muted'}`}>
                {added ? '✓ Added' : `${EQUIPMENT_LABEL[e.equipment]} +`}
              </span>
            </button>
          )
        }}
      />
    </>
  )
}
