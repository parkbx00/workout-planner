import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db.ts'
import {
  deleteTemplate,
  listTemplateExercises,
  removeTemplateExercise,
  reorderTemplateExercises,
  updateTemplate,
  updateTemplateExercise,
  type TargetPatch,
} from '../db/templates.ts'
import type { Exercise, Template, TemplateExercise } from '../db/types.ts'
import { DAY_LABEL, EQUIPMENT_LABEL, MUSCLE_LABEL } from '../lib/labels.ts'

type Row = TemplateExercise & { exercise: Exercise | undefined }

export default function TemplateEditor() {
  const { id = '' } = useParams()
  // undefined = loading, null = not found
  const data = useLiveQuery(async () => {
    const template = await db.templates.get(id)
    if (!template) return null
    const items = await listTemplateExercises(id)
    const exercises = await db.exercises.bulkGet(items.map((i) => i.exerciseId))
    const rows: Row[] = items.map((item, i) => ({ ...item, exercise: exercises[i] }))
    return { template, rows }
  }, [id])

  if (data === undefined) return null
  if (data === null) {
    return (
      <>
        <BackLink />
        <p className="text-muted mt-6">This template no longer exists.</p>
      </>
    )
  }
  return <Editor key={id} template={data.template} rows={data.rows} />
}

function BackLink() {
  return (
    <Link to="/templates" className="text-accent -ml-2 flex min-h-11 w-fit items-center px-2">
      ‹ Templates
    </Link>
  )
}

function Editor({ template, rows }: { template: Template; rows: Row[] }) {
  const navigate = useNavigate()
  const [name, setName] = useState<string | null>(null) // null = not being edited
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Holds the dropped order until the database write lands, so rows don't snap back for a frame.
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ordered = pendingOrder
    ? pendingOrder.flatMap((rowId) => rows.find((r) => r.id === rowId) ?? [])
    : rows

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = ordered.map((r) => r.id)
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    setPendingOrder(next)
    await reorderTemplateExercises(template.id, next)
    setPendingOrder(null)
  }

  async function remove() {
    await deleteTemplate(template.id)
    navigate('/templates')
  }

  return (
    <>
      <BackLink />

      <input
        value={name ?? template.name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name !== null) void updateTemplate(template.id, { name })
          setName(null)
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="Template name"
        enterKeyHint="done"
        className="focus:bg-surface -mx-2 mt-1 w-[calc(100%+1rem)] rounded-lg bg-transparent px-2 py-1 text-3xl! font-bold tracking-tight outline-none"
      />

      <label className="mt-3 flex items-center justify-between gap-3">
        <span className="text-muted">Day</span>
        <select
          value={template.dayOfWeek ?? ''}
          onChange={(e) =>
            void updateTemplate(template.id, {
              dayOfWeek: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          className="bg-surface h-11 rounded-xl px-3 outline-none"
        >
          <option value="">No set day</option>
          {DAY_LABEL.map((label, day) => (
            <option key={label} value={day}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <h2 className="text-muted mt-6 mb-2 text-xs font-semibold tracking-wide uppercase">
        Exercises · {ordered.length}
      </h2>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ordered.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-3">
            {ordered.map((row) => (
              <ExerciseRow key={row.id} row={row} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {ordered.length === 0 && <p className="text-muted">No exercises yet.</p>}

      <Link
        to={`/templates/edit/${template.id}/add`}
        className="border-line text-accent mt-3 flex min-h-12 w-full items-center justify-center rounded-xl border border-dashed font-semibold"
      >
        + Add exercise
      </Link>

      <button
        type="button"
        onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
        onBlur={() => setConfirmDelete(false)}
        className={`mt-10 min-h-12 w-full rounded-xl font-medium ${
          confirmDelete ? 'bg-red-600 text-white' : 'bg-surface text-red-400'
        }`}
      >
        {confirmDelete ? 'Tap again to delete' : 'Delete template'}
      </button>
      <p className="text-muted mt-2 text-center text-sm">
        Changes save automatically. Deleting a template keeps your logged workouts.
      </p>
    </>
  )
}

function ExerciseRow({ row }: { row: Row }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id })

  const commit = (patch: TargetPatch) => void updateTemplateExercise(row.id, patch)
  const name = row.exercise?.name ?? 'Unknown exercise'

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`bg-surface rounded-xl p-3 ${
        isDragging ? 'ring-accent relative z-10 shadow-xl ring-1' : ''
      }`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${name}`}
          className="text-muted -ml-2 flex h-11 w-11 shrink-0 touch-none items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="6" r="1.6" />
            <circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" />
            <circle cx="15" cy="18" r="1.6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{name}</div>
          {row.exercise && (
            <div className="text-muted text-sm">
              {MUSCLE_LABEL[row.exercise.muscleGroup]} · {EQUIPMENT_LABEL[row.exercise.equipment]}
              {row.exercise.archived && ' · archived'}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void removeTemplateExercise(row.id)}
          aria-label={`Remove ${name}`}
          className="text-muted -mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-xl"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2">
        <NumField label="Sets" value={row.targetSets} onCommit={(n) => commit({ targetSets: n })} />
        <NumField label="Min reps" value={row.repMin} onCommit={(n) => commit({ repMin: n })} />
        <NumField label="Max reps" value={row.repMax} onCommit={(n) => commit({ repMax: n })} />
        <NumField
          label="Rest (s)"
          value={row.restSeconds}
          onCommit={(n) => commit({ restSeconds: n })}
        />
      </div>
    </li>
  )
}

/**
 * Saves when the field loses focus (or on Enter), not on every keystroke:
 * typing "15" passes through "1", which would otherwise drag the other end of the rep range with it.
 */
function NumField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState<string | null>(null) // null = not being edited

  return (
    <label className="block">
      <span className="text-muted mb-1 block text-center text-xs">{label}</span>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        value={text ?? String(value)}
        onFocus={(e) => {
          setText(String(value))
          e.currentTarget.select()
        }}
        onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onBlur={() => {
          if (text !== null && text !== '' && Number(text) !== value) onCommit(Number(text))
          setText(null)
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="bg-surface-2 focus:ring-accent h-11 w-full rounded-lg text-center font-semibold outline-none focus:ring-1"
      />
    </label>
  )
}
