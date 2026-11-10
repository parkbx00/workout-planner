export const MUSCLE_GROUPS = [
  'chest',
  'shoulders',
  'triceps',
  'back',
  'biceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const EQUIPMENT = ['machine', 'smith', 'cable', 'dumbbell', 'bodyweight'] as const
export type Equipment = (typeof EQUIPMENT)[number]

export type Unit = 'lb' | 'kg'

/** All timestamps are epoch milliseconds. Every record has `updatedAt` so sync can be added later. */

export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  equipment: Equipment
  incrementLb: number
  incrementKg: number
  isCustom: boolean
  archived: boolean
  updatedAt: number
}

export interface Template {
  id: string
  name: string
  /** 0 = Sunday … 6 = Saturday; null = not tied to a day. */
  dayOfWeek: number | null
  order: number
  updatedAt: number
}

export interface TemplateExercise {
  id: string
  templateId: string
  exerciseId: string
  order: number
  targetSets: number
  repMin: number
  repMax: number
  restSeconds: number
  updatedAt: number
}

export interface Session {
  id: string
  templateId: string | null
  startedAt: number
  endedAt: number | null
  notes: string
  updatedAt: number
}

/**
 * One exercise card inside a session. Snapshots the template's targets so that
 * swaps, added exercises, reordering and later template edits don't alter history.
 */
export interface SessionExercise {
  id: string
  sessionId: string
  exerciseId: string
  order: number
  targetSets: number
  repMin: number
  repMax: number
  restSeconds: number
  updatedAt: number
}

export interface WorkoutSet {
  id: string
  sessionId: string
  sessionExerciseId: string
  exerciseId: string
  order: number
  weight: number | null
  unit: Unit
  reps: number | null
  completed: boolean
  completedAt: number | null
  updatedAt: number
}

export interface Setting {
  key: string
  value: unknown
  updatedAt: number
}
