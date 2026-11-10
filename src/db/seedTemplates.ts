/** [exercise name in the library, sets, repMin, repMax, restSeconds] */
type Row = [name: string, sets: number, repMin: number, repMax: number, restSeconds: number]

/**
 * The starting split. This only pre-fills the templates once; everything here
 * is editable in the template editor afterwards.
 */
export const TEMPLATE_SEEDS: { name: string; dayOfWeek: number; exercises: Row[] }[] = [
  {
    name: 'Chest / Shoulders',
    dayOfWeek: 1,
    exercises: [
      ['Smith Incline Bench Press', 3, 8, 12, 120],
      ['Chest Press Machine', 3, 8, 12, 120],
      ['Pec Fly Machine', 3, 10, 15, 90],
      ['Shoulder Press Machine', 3, 8, 12, 120],
      ['Dumbbell Lateral Raise', 3, 12, 15, 60],
      ['Rear Delt Fly Machine', 3, 12, 15, 60],
      ['Cable Triceps Pushdown', 3, 10, 12, 60],
    ],
  },
  {
    name: 'Legs',
    dayOfWeek: 2,
    exercises: [
      ['Smith Squat', 3, 8, 12, 150],
      ['Leg Press', 3, 10, 12, 120],
      ['Dumbbell Romanian Deadlift', 3, 8, 12, 120],
      ['Leg Extension', 3, 12, 15, 90],
      ['Seated Leg Curl', 3, 10, 12, 90],
      ['Smith Calf Raise', 3, 12, 15, 60],
    ],
  },
  {
    name: 'Back / Biceps',
    dayOfWeek: 3,
    exercises: [
      ['Lat Pulldown Machine', 3, 8, 12, 120],
      ['Seated Cable Row', 3, 8, 12, 120],
      ['Chest-Supported Row Machine', 3, 8, 12, 120],
      ['Cable Straight-Arm Pulldown', 3, 12, 15, 60],
      ['Dumbbell Curl', 3, 10, 12, 60],
      ['Cable Hammer Curl', 3, 10, 12, 60],
    ],
  },
]
