import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db.ts'

export default function Templates() {
  const count = useLiveQuery(() => db.exercises.filter((e) => !e.archived).count(), [])

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
      <p className="text-muted mt-3">The template editor arrives in Phase 2.</p>

      <Link
        to="/templates/exercises"
        className="bg-surface mt-6 flex min-h-14 items-center justify-between rounded-xl px-4"
      >
        <span className="font-medium">Exercise library</span>
        <span className="text-muted">{count ?? '…'} exercises ›</span>
      </Link>
    </>
  )
}
