import type { Unit, WorkoutSet } from '../db/types.ts'
import { LB_PER_KG, toLb } from './units.ts'

/** Epley estimate: 1RM = weight × (1 + reps / 30). */
export function epley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

type Loggable = Pick<WorkoutSet, 'weight' | 'unit' | 'reps' | 'completed'>

/** Sum of weight × reps over completed sets, expressed in `unit`. */
export function totalVolume(sets: Loggable[], unit: Unit): number {
  const lb = sets.reduce(
    (sum, s) => (s.completed && s.weight && s.reps ? sum + toLb(s.weight, s.unit) * s.reps : sum),
    0,
  )
  return unit === 'lb' ? lb : lb / LB_PER_KG
}

/** The completed set with the highest estimated 1RM (compared in lb), or null if none has weight and reps. */
export function bestSet<T extends Loggable>(sets: T[]): { set: T; e1rmLb: number } | null {
  let best: { set: T; e1rmLb: number } | null = null
  for (const set of sets) {
    if (!set.completed || !set.weight || !set.reps) continue
    const e1rmLb = epley1RM(toLb(set.weight, set.unit), set.reps)
    if (!best || e1rmLb > best.e1rmLb) best = { set, e1rmLb }
  }
  return best
}
