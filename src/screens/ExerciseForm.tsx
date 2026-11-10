import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db.ts'
import {
  createExercise,
  defaultIncrements,
  ExerciseValidationError,
  setExerciseArchived,
  updateExercise,
} from '../db/exercises.ts'
import {
  EQUIPMENT,
  MUSCLE_GROUPS,
  type Equipment,
  type Exercise,
  type MuscleGroup,
} from '../db/types.ts'
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../lib/labels.ts'

const LIST = '/templates/exercises'

export default function ExerciseForm() {
  const { id } = useParams()
  // undefined = loading, null = not found
  const existing = useLiveQuery(
    async () => (id ? ((await db.exercises.get(id)) ?? null) : null),
    [id],
  )

  if (id && existing === undefined) return null
  if (id && existing === null) {
    return (
      <>
        <BackLink />
        <p className="text-muted mt-6">This exercise no longer exists.</p>
      </>
    )
  }
  // key: reset the form state if the route switches to a different exercise
  return <Form key={id ?? 'new'} existing={existing ?? null} />
}

function BackLink() {
  return (
    <Link to={LIST} className="text-accent -ml-2 flex min-h-11 w-fit items-center px-2">
      ‹ Exercises
    </Link>
  )
}

function Form({ existing }: { existing: Exercise | null }) {
  const navigate = useNavigate()
  const [name, setName] = useState(existing?.name ?? '')
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(existing?.muscleGroup ?? 'chest')
  const [equipment, setEquipment] = useState<Equipment>(existing?.equipment ?? 'machine')
  const [incrementLb, setIncrementLb] = useState(String(existing?.incrementLb ?? 5))
  const [incrementKg, setIncrementKg] = useState(String(existing?.incrementKg ?? 2.5))
  // Until the user types an increment, keep it following the muscle group's default.
  const [incrementsTouched, setIncrementsTouched] = useState(existing !== null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function changeMuscleGroup(next: MuscleGroup) {
    setMuscleGroup(next)
    if (!incrementsTouched) {
      const d = defaultIncrements(next)
      setIncrementLb(String(d.incrementLb))
      setIncrementKg(String(d.incrementKg))
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const input = {
      name,
      muscleGroup,
      equipment,
      incrementLb: Number(incrementLb),
      incrementKg: Number(incrementKg),
    }
    try {
      if (existing) await updateExercise(existing.id, input)
      else await createExercise(input)
      navigate(LIST)
    } catch (err) {
      setSaving(false)
      if (err instanceof ExerciseValidationError) setError(err.message)
      else throw err
    }
  }

  async function toggleArchived() {
    if (!existing) return
    await setExerciseArchived(existing.id, !existing.archived)
    navigate(LIST)
  }

  const field = 'bg-surface h-12 w-full rounded-xl px-4 outline-none'

  return (
    <form onSubmit={save}>
      <BackLink />
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        {existing ? 'Edit exercise' : 'New exercise'}
      </h1>

      <div className="mt-5 space-y-4">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cable Y-Raise"
            autoCapitalize="words"
            autoCorrect="off"
            className={`${field} placeholder:text-muted`}
          />
        </Field>

        <Field label="Muscle group">
          <select
            value={muscleGroup}
            onChange={(e) => changeMuscleGroup(e.target.value as MuscleGroup)}
            className={field}
          >
            {MUSCLE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {MUSCLE_LABEL[g]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Equipment">
          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value as Equipment)}
            className={field}
          >
            {EQUIPMENT.map((eq) => (
              <option key={eq} value={eq}>
                {EQUIPMENT_LABEL[eq]}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Increment (lb)">
            <input
              value={incrementLb}
              onChange={(e) => {
                setIncrementLb(e.target.value)
                setIncrementsTouched(true)
              }}
              inputMode="decimal"
              className={field}
            />
          </Field>
          <Field label="Increment (kg)">
            <input
              value={incrementKg}
              onChange={(e) => {
                setIncrementKg(e.target.value)
                setIncrementsTouched(true)
              }}
              inputMode="decimal"
              className={field}
            />
          </Field>
        </div>
        <p className="text-muted text-sm">
          The increment is the weight jump the app suggests when you're ready to progress.
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-950 px-4 py-3 text-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="bg-accent text-accent-ink mt-6 min-h-12 w-full rounded-xl text-lg font-semibold disabled:opacity-50"
      >
        {existing ? 'Save changes' : 'Add exercise'}
      </button>

      {existing && (
        <>
          <button
            type="button"
            onClick={toggleArchived}
            className={`bg-surface mt-3 min-h-12 w-full rounded-xl font-medium ${
              existing.archived ? 'text-text' : 'text-red-400'
            }`}
          >
            {existing.archived ? 'Restore exercise' : 'Archive exercise'}
          </button>
          {!existing.archived && (
            <p className="text-muted mt-2 text-center text-sm">
              Archiving hides it from the library. Logged history is kept, and you can restore it.
            </p>
          )}
        </>
      )}
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-muted mb-1.5 block text-sm">{label}</span>
      {children}
    </label>
  )
}
