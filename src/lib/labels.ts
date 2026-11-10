import type { Equipment, MuscleGroup } from '../db/types.ts'

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  back: 'Back',
  biceps: 'Biceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes & hips',
  calves: 'Calves',
  core: 'Core',
}

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  machine: 'Machine',
  smith: 'Smith',
  cable: 'Cable',
  dumbbell: 'Dumbbell',
  bodyweight: 'Bodyweight',
}

export const DAY_LABEL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const
