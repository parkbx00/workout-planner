import type { Unit } from '../db/types.ts'
import { formatWeight } from './format.ts'

/**
 * Double progression: add reps within the rep range, then add weight and
 * start again at the bottom of the range.
 *
 * Judged on the most recent session's *working sets*, meaning the sets done at
 * the heaviest weight used that day (lighter warm-up or back-off sets are ignored):
 *
 *   1. every set reached repMax          → weight + increment, at repMin
 *   2. every set within [repMin, repMax] → same weight, +1 rep on the set with the fewest reps
 *   3. any set below repMin              → same weight; if that also happened the session
 *                                          before, −10% (rounded to the nearest increment)
 *   4. no history                        → no suggestion (the first session is the baseline)
 *
 * A past session is judged against the rep range it was logged with. The new
 * target uses the range on today's card.
 *
 * Bodyweight sets (no weight) can't add load, so rule 1 becomes "+1 rep" and
 * rule 3 never deloads.
 */

export interface LoggedSet {
  weight: number | null
  reps: number
}

export interface PastSession {
  /** Completed sets in the order they were done, weights already in the display unit. */
  sets: LoggedSet[]
  repMin: number
  repMax: number
}

export type SuggestionKind = 'increase' | 'add-rep' | 'repeat' | 'deload'

export interface Suggestion {
  kind: SuggestionKind
  /** null for bodyweight */
  weight: number | null
  /** Target reps for each set, one entry per target set. */
  reps: number[]
}

type Outcome = 'hit-max' | 'in-range' | 'missed'

function judge(session: PastSession): { top: number; working: LoggedSet[]; outcome: Outcome } {
  const top = Math.max(...session.sets.map((s) => s.weight ?? 0))
  const working = session.sets.filter((s) => (s.weight ?? 0) === top)
  const outcome: Outcome = working.some((s) => s.reps < session.repMin)
    ? 'missed'
    : working.every((s) => s.reps >= session.repMax)
      ? 'hit-max'
      : 'in-range'
  return { top, working, outcome }
}

const tidy = (n: number) => Number(n.toFixed(2))

export function suggest(input: {
  /** Finished sessions that include this exercise, most recent first. Only the first two are used. */
  history: PastSession[]
  /** Weight jump for this exercise, in the display unit. */
  increment: number
  repMin: number
  repMax: number
  targetSets: number
}): Suggestion | null {
  const { increment, repMin } = input
  const history = input.history.filter((s) => s.sets.length > 0)
  const last = history[0]
  if (!last) return null

  const { top, working, outcome } = judge(last)
  const weight = top > 0 ? top : null
  const perSet = (fn: (i: number) => number) =>
    Array.from({ length: Math.max(1, input.targetSets) }, (_, i) => fn(i))
  const lastReps = (i: number) => (working[i] ?? working[working.length - 1]).reps

  if (outcome === 'missed') {
    const before = history[1]
    if (weight !== null && before && judge(before).outcome === 'missed') {
      let lighter = Math.round((weight * 0.9) / increment) * increment
      if (lighter >= weight) lighter = weight - increment
      if (lighter > 0) return { kind: 'deload', weight: tidy(lighter), reps: perSet(() => repMin) }
    }
    return { kind: 'repeat', weight, reps: perSet((i) => Math.max(lastReps(i), repMin)) }
  }

  if (outcome === 'hit-max' && weight !== null) {
    return { kind: 'increase', weight: tidy(weight + increment), reps: perSet(() => repMin) }
  }

  const reps = perSet(lastReps)
  reps[reps.indexOf(Math.min(...reps))] += 1
  return { kind: 'add-rep', weight, reps }
}

const NOTE: Record<SuggestionKind, string> = {
  increase: 'weight up',
  'add-rep': 'add a rep',
  repeat: 'same weight, reach the minimum',
  deload: '10% lighter after two tough sessions',
}

/** "140 lb × 8 · weight up", "135 lb × 10, 10, 9 · add a rep", "12, 11, 11 reps · add a rep" */
export function describeSuggestion(s: Suggestion, unit: Unit): string {
  const reps = s.reps.every((r) => r === s.reps[0]) ? String(s.reps[0]) : s.reps.join(', ')
  const target =
    s.weight === null ? `${reps} reps` : `${formatWeight(s.weight)} ${unit} × ${reps}`
  return `${target} · ${NOTE[s.kind]}`
}
