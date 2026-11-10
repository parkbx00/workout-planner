import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import ExerciseBrowser from '../components/ExerciseBrowser.tsx'
import { db } from '../db/db.ts'
import { EQUIPMENT_LABEL } from '../lib/labels.ts'

export default function Exercises() {
  const all = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])
  const [showArchived, setShowArchived] = useState(false)
  const archivedCount = all?.filter((e) => e.archived).length ?? 0

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

      <ExerciseBrowser
        exercises={all?.filter((e) => e.archived === showArchived)}
        emptyText={showArchived ? 'No archived exercises.' : 'No exercises match.'}
        renderRow={(e) => (
          <Link
            to={`/templates/exercises/${e.id}`}
            className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
          >
            <span className="font-medium">
              {e.name}
              {e.isCustom && <span className="text-accent ml-2 text-xs font-semibold">Custom</span>}
            </span>
            <span className="text-muted shrink-0 text-sm">{EQUIPMENT_LABEL[e.equipment]} ›</span>
          </Link>
        )}
      />

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
