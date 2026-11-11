import { db, newId } from './db.ts'
import { bodyHalf, FACTORY_INCREMENTS, type IncrementDefaults } from './settings.ts'
import type { Equipment, Exercise, MuscleGroup } from './types.ts'

/**
 * Default weight jumps for a muscle group: 5 lb / 2.5 kg for upper body and
 * 10 lb / 5 kg for lower body, unless changed in Settings.
 */
export function defaultIncrements(
  muscleGroup: MuscleGroup,
  defaults: IncrementDefaults = FACTORY_INCREMENTS,
) {
  const d = defaults[bodyHalf(muscleGroup)]
  return { incrementLb: d.lb, incrementKg: d.kg }
}

export interface ExerciseInput {
  name: string
  muscleGroup: MuscleGroup
  equipment: Equipment
  incrementLb: number
  incrementKg: number
}

export class ExerciseValidationError extends Error {}

async function validate(input: ExerciseInput, ignoreId?: string): Promise<ExerciseInput> {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (!name) throw new ExerciseValidationError('Enter a name.')
  for (const inc of [input.incrementLb, input.incrementKg]) {
    if (!Number.isFinite(inc) || inc <= 0) {
      throw new ExerciseValidationError('Increments must be greater than 0.')
    }
  }
  const clash = await db.exercises
    .filter((e) => e.id !== ignoreId && e.name.toLowerCase() === name.toLowerCase())
    .first()
  if (clash) {
    throw new ExerciseValidationError(
      clash.archived
        ? `"${clash.name}" already exists but is archived. Restore it instead.`
        : `"${clash.name}" already exists.`,
    )
  }
  return { ...input, name }
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const exercise: Exercise = {
    ...(await validate(input)),
    id: newId(),
    isCustom: true,
    archived: false,
    updatedAt: Date.now(),
  }
  await db.exercises.add(exercise)
  return exercise
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<void> {
  const clean = await validate(input, id)
  await db.exercises.update(id, { ...clean, updatedAt: Date.now() })
}

/** Exercises are archived, never deleted, so past sessions keep pointing at a real record. */
export async function setExerciseArchived(id: string, archived: boolean): Promise<void> {
  await db.exercises.update(id, { archived, updatedAt: Date.now() })
}
