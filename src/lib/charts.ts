import { MUSCLE_GROUPS, type MuscleGroup, type Unit, type WorkoutSet } from '../db/types.ts'
import { epley1RM } from './stats.ts'
import { convertWeight, LB_PER_KG, toLb } from './units.ts'

export interface TrendPoint {
  /** Session start, epoch ms. */
  t: number
  /** Best estimated 1RM that session, in the display unit. */
  e1rm: number
  /** Heaviest weight lifted that session, in the display unit… */
  topWeight: number
  /** …and the most reps done at that weight. */
  topReps: number
}

type Loggable = Pick<WorkoutSet, 'weight' | 'unit' | 'reps' | 'completed'>

/**
 * One point per session (oldest first) for the estimated-1RM and top-set charts.
 * Sessions with no weighted sets (bodyweight) are left out.
 */
export function exerciseTrend(
  sessions: { startedAt: number; sets: Loggable[] }[],
  unit: Unit,
): TrendPoint[] {
  const points: TrendPoint[] = []
  for (const { startedAt, sets } of sessions) {
    const weighted = sets.filter((s) => s.completed && s.weight && s.reps)
    if (weighted.length === 0) continue
    const e1rmLb = Math.max(...weighted.map((s) => epley1RM(toLb(s.weight!, s.unit), s.reps!)))
    const topLb = Math.max(...weighted.map((s) => toLb(s.weight!, s.unit)))
    const top = weighted
      .filter((s) => Math.abs(toLb(s.weight!, s.unit) - topLb) < 1e-6)
      .reduce((a, b) => (b.reps! > a.reps! ? b : a))
    points.push({
      t: startedAt,
      e1rm: Math.round((unit === 'lb' ? e1rmLb : e1rmLb / LB_PER_KG) * 10) / 10,
      topWeight: convertWeight(top.weight!, top.unit, unit),
      topReps: top.reps!,
    })
  }
  return points.sort((a, b) => a.t - b.t)
}

/** Local midnight on the Monday of the week containing `ms`. */
export function weekStart(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

/** The Monday `weeks` weeks away from the given Monday (handles daylight-saving shifts). */
export function shiftWeek(monday: number, weeks: number): number {
  const d = new Date(monday)
  d.setDate(d.getDate() + weeks * 7)
  return d.getTime()
}

export type MuscleCounts = Record<MuscleGroup, number>

export const emptyMuscleCounts = (): MuscleCounts =>
  Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0])) as MuscleCounts

/**
 * Completed sets per muscle group, bucketed by the week (Monday start) of the
 * session they belong to. Every completed set counts as a working set.
 */
export function weeklySetsByMuscle(
  sets: { startedAt: number; muscleGroup: MuscleGroup }[],
): Map<number, MuscleCounts> {
  const weeks = new Map<number, MuscleCounts>()
  for (const { startedAt, muscleGroup } of sets) {
    const week = weekStart(startedAt)
    let counts = weeks.get(week)
    if (!counts) weeks.set(week, (counts = emptyMuscleCounts()))
    counts[muscleGroup] += 1
  }
  return weeks
}

/** Up to `max` evenly spread values from a sorted list, always including the first and last. */
export function spreadTicks(values: number[], max = 4): number[] {
  if (values.length <= max) return values
  return Array.from(
    { length: max },
    (_, i) => values[Math.round((i * (values.length - 1)) / (max - 1))],
  )
}
