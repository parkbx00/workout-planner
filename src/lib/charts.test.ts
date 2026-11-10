import { describe, expect, it } from 'vitest'
import { exerciseTrend, shiftWeek, spreadTicks, weeklySetsByMuscle, weekStart } from './charts.ts'

const set = (weight: number | null, reps: number, unit: 'lb' | 'kg' = 'lb', completed = true) => ({
  weight,
  reps,
  unit,
  completed,
})
const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h).getTime()

describe('exerciseTrend', () => {
  it('gives one point per session, oldest first, with best e1RM and the top set', () => {
    const points = exerciseTrend(
      [
        { startedAt: at(2026, 11, 10), sets: [set(140, 8), set(140, 7), set(120, 12)] },
        { startedAt: at(2026, 11, 3), sets: [set(135, 10), set(135, 9)] },
      ],
      'lb',
    )
    expect(points.map((p) => p.t)).toEqual([at(2026, 11, 3), at(2026, 11, 10)])
    expect(points[0]).toMatchObject({ e1rm: 180, topWeight: 135, topReps: 10 })
    // 140 × 8 → 177.3; 120 × 12 → 168: best e1RM is the 140 set, top set is 140 × 8
    expect(points[1]).toMatchObject({ e1rm: 177.3, topWeight: 140, topReps: 8 })
  })

  it('can have the best e1RM come from a lighter, higher-rep set than the top set', () => {
    const [p] = exerciseTrend([{ startedAt: 0, sets: [set(200, 1), set(150, 15)] }], 'lb')
    expect(p).toMatchObject({ topWeight: 200, topReps: 1, e1rm: 225 })
  })

  it('skips unchecked sets and sessions with no weighted sets', () => {
    const points = exerciseTrend(
      [
        { startedAt: 1, sets: [set(null, 12), set(0, 10)] }, // bodyweight
        { startedAt: 2, sets: [set(100, 10), set(500, 5, 'lb', false)] },
      ],
      'lb',
    )
    expect(points).toEqual([{ t: 2, e1rm: 133.3, topWeight: 100, topReps: 10 }])
  })

  it('converts mixed-unit history into the display unit', () => {
    const sessions = [
      { startedAt: 1, sets: [set(60, 10, 'kg')] },
      { startedAt: 2, sets: [set(135, 10, 'lb')] },
    ]
    expect(exerciseTrend(sessions, 'lb').map((p) => p.topWeight)).toEqual([132.5, 135])
    expect(exerciseTrend(sessions, 'kg').map((p) => p.topWeight)).toEqual([60, 61])
    expect(exerciseTrend(sessions, 'kg')[0].e1rm).toBe(80)
  })
})

describe('weeks', () => {
  it('starts weeks on Monday at local midnight', () => {
    const monday = new Date(2026, 10, 9).getTime() // Mon 9 Nov 2026
    expect(weekStart(at(2026, 11, 9, 0))).toBe(monday)
    expect(weekStart(at(2026, 11, 10))).toBe(monday) // Tuesday
    expect(weekStart(at(2026, 11, 15, 23))).toBe(monday) // Sunday night
    expect(weekStart(at(2026, 11, 16, 0))).toBe(new Date(2026, 10, 16).getTime())
    expect(shiftWeek(monday, -1)).toBe(new Date(2026, 10, 2).getTime())
  })

  it('counts completed sets per muscle group per week', () => {
    const weeks = weeklySetsByMuscle([
      { startedAt: at(2026, 11, 9), muscleGroup: 'chest' },
      { startedAt: at(2026, 11, 9), muscleGroup: 'chest' },
      { startedAt: at(2026, 11, 10), muscleGroup: 'quads' },
      { startedAt: at(2026, 11, 3), muscleGroup: 'back' },
    ])
    const thisWeek = weeks.get(new Date(2026, 10, 9).getTime())!
    expect(thisWeek).toMatchObject({ chest: 2, quads: 1, back: 0, core: 0 })
    expect(Object.keys(thisWeek)).toHaveLength(10)
    expect(weeks.get(new Date(2026, 10, 2).getTime())!.back).toBe(1)
    expect(weeks.size).toBe(2)
  })
})

describe('spreadTicks', () => {
  it('keeps short lists and thins long ones, always keeping both ends', () => {
    expect(spreadTicks([1, 2, 3])).toEqual([1, 2, 3])
    expect(spreadTicks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([1, 4, 7, 10])
  })
})
