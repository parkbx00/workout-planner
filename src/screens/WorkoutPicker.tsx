import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ExerciseBrowser from '../components/ExerciseBrowser.tsx'
import Sheet, { SheetButton } from '../components/Sheet.tsx'
import { db } from '../db/db.ts'
import {
  addSessionExercise,
  getActiveSession,
  swapSessionExercise,
  templateListsExercise,
} from '../db/sessions.ts'
import type { Exercise } from '../db/types.ts'
import { EQUIPMENT_LABEL } from '../lib/labels.ts'

/**
 * Exercise picker for the live workout.
 *   /workout/add                → adds the tapped exercise to the workout
 *   /workout/swap/:cardId       → swaps that card's exercise (opens on the same muscle group)
 */
export default function WorkoutPicker() {
  const { cardId } = useParams()
  const navigate = useNavigate()
  const [picked, setPicked] = useState<Exercise | null>(null)

  const data = useLiveQuery(async () => {
    const session = await getActiveSession()
    if (!session) return null
    const card = cardId ? await db.sessionExercises.get(cardId) : undefined
    const [exercises, current, template] = await Promise.all([
      db.exercises.orderBy('name').toArray(),
      card ? db.exercises.get(card.exerciseId) : undefined,
      session.templateId ? db.templates.get(session.templateId) : undefined,
    ])
    return {
      session,
      card,
      current,
      templateName: template?.name,
      inTemplate: card ? await templateListsExercise(session.id, card.exerciseId) : false,
      exercises: exercises.filter((e) => !e.archived && e.id !== card?.exerciseId),
    }
  }, [cardId])

  if (data === undefined) return null
  if (data === null || (cardId && !data.card)) {
    return (
      <Link to="/workout" className="text-accent flex min-h-11 items-center">
        ‹ Back to workout
      </Link>
    )
  }
  const { session, card } = data

  async function swap(exercise: Exercise, alsoUpdateTemplate: boolean) {
    await swapSessionExercise(card!.id, exercise.id, alsoUpdateTemplate)
    navigate('/workout')
  }

  async function pick(exercise: Exercise) {
    if (!card) {
      await addSessionExercise(session.id, exercise.id)
      navigate('/workout')
    } else if (data!.inTemplate) {
      setPicked(exercise) // ask: today only, or the template too?
    } else {
      await swap(exercise, false)
    }
  }

  return (
    <>
      <Link to="/workout" className="text-accent -ml-2 flex min-h-11 w-fit items-center px-2">
        ‹ Workout
      </Link>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        {card ? 'Swap exercise' : 'Add exercise'}
      </h1>
      {card && (
        <p className="text-muted mt-1 text-sm">
          Replacing {data.current?.name ?? 'this exercise'}. Sets you've already checked off stay
          logged under it.
        </p>
      )}

      <ExerciseBrowser
        exercises={data.exercises}
        initialGroup={card ? (data.current?.muscleGroup ?? 'all') : 'all'}
        emptyText="No exercises match."
        renderRow={(e) => (
          <button
            type="button"
            onClick={() => void pick(e)}
            className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left"
          >
            <span className="font-medium">{e.name}</span>
            <span className="text-muted shrink-0 text-sm">{EQUIPMENT_LABEL[e.equipment]}</span>
          </button>
        )}
      />

      {picked && (
        <Sheet title={`Swap to ${picked.name}`} onClose={() => setPicked(null)}>
          <SheetButton tone="primary" onClick={() => void swap(picked, false)}>
            Today only
          </SheetButton>
          <SheetButton onClick={() => void swap(picked, true)}>
            Also update the {data.templateName ?? ''} template
          </SheetButton>
          <SheetButton onClick={() => setPicked(null)}>Cancel</SheetButton>
        </Sheet>
      )}
    </>
  )
}
