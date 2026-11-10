import type { Equipment, MuscleGroup } from './types.ts'

type SeedGroup = Partial<Record<Equipment, string[]>>

/**
 * Movements available at a Planet Fitness: machines, Smith machine, cables,
 * dumbbells and bodyweight (no free barbells).
 *
 * To add exercises later, append a new entry to EXERCISE_SEEDS with the next
 * version number; existing installs pick up only the new entry.
 */
const V1: Record<MuscleGroup, SeedGroup> = {
  chest: {
    machine: ['Chest Press Machine', 'Incline Chest Press Machine', 'Pec Fly Machine'],
    smith: ['Smith Bench Press', 'Smith Incline Bench Press'],
    cable: ['Cable Crossover', 'Low-to-High Cable Fly'],
    dumbbell: ['Dumbbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Fly'],
    bodyweight: ['Push-Up'],
  },
  shoulders: {
    machine: ['Shoulder Press Machine', 'Lateral Raise Machine', 'Rear Delt Fly Machine'],
    smith: ['Smith Overhead Press', 'Smith Shrug'],
    cable: ['Cable Lateral Raise', 'Cable Face Pull'],
    dumbbell: [
      'Dumbbell Shoulder Press',
      'Dumbbell Lateral Raise',
      'Dumbbell Front Raise',
      'Dumbbell Rear Delt Fly',
      'Dumbbell Shrug',
    ],
  },
  triceps: {
    machine: ['Triceps Extension Machine', 'Seated Dip Machine', 'Assisted Dip'],
    cable: ['Cable Triceps Pushdown', 'Cable Rope Pushdown', 'Cable Overhead Triceps Extension'],
    dumbbell: ['Dumbbell Overhead Triceps Extension', 'Dumbbell Skull Crusher'],
    bodyweight: ['Bench Dip'],
  },
  back: {
    machine: ['Lat Pulldown Machine', 'Seated Row Machine', 'Assisted Pull-Up', 'Back Extension Machine'],
    smith: ['Smith Bent-Over Row'],
    cable: ['Cable Lat Pulldown', 'Seated Cable Row', 'Cable Straight-Arm Pulldown'],
    dumbbell: ['Dumbbell Row', 'Chest-Supported Dumbbell Row'],
    bodyweight: ['Pull-Up', 'Inverted Row'],
  },
  biceps: {
    machine: ['Biceps Curl Machine', 'Preacher Curl Machine'],
    cable: ['Cable Curl', 'Cable Hammer Curl'],
    dumbbell: ['Dumbbell Curl', 'Hammer Curl', 'Incline Dumbbell Curl', 'Concentration Curl'],
  },
  quads: {
    machine: ['Leg Press', 'Leg Extension', 'Hack Squat Machine'],
    smith: ['Smith Squat', 'Smith Lunge'],
    dumbbell: ['Goblet Squat', 'Dumbbell Lunge', 'Dumbbell Bulgarian Split Squat', 'Dumbbell Step-Up'],
  },
  hamstrings: {
    machine: ['Seated Leg Curl', 'Lying Leg Curl'],
    smith: ['Smith Romanian Deadlift'],
    dumbbell: ['Dumbbell Romanian Deadlift'],
  },
  glutes: {
    machine: ['Hip Abduction Machine', 'Hip Adduction Machine', 'Glute Kickback Machine'],
    smith: ['Smith Hip Thrust'],
    cable: ['Cable Glute Kickback', 'Cable Pull-Through'],
    dumbbell: ['Dumbbell Hip Thrust'],
  },
  calves: {
    machine: ['Seated Calf Raise Machine', 'Leg Press Calf Raise'],
    smith: ['Smith Calf Raise'],
    dumbbell: ['Dumbbell Calf Raise'],
  },
  core: {
    machine: ['Ab Crunch Machine', 'Torso Rotation Machine'],
    cable: ['Cable Crunch', 'Cable Woodchop'],
    bodyweight: ["Captain's Chair Leg Raise", 'Hanging Knee Raise', 'Crunch'],
  },
}

export const EXERCISE_SEEDS: { version: number; exercises: Record<MuscleGroup, SeedGroup> }[] = [
  { version: 1, exercises: V1 },
]
