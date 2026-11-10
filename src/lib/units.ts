import type { Unit } from '../db/types.ts'

export const LB_PER_KG = 2.20462

/** Converts between units, rounded to the nearest 0.5. Same-unit values pass through untouched. */
export function convertWeight(weight: number, from: Unit, to: Unit): number {
  if (from === to) return weight
  const raw = from === 'kg' ? weight * LB_PER_KG : weight / LB_PER_KG
  return Math.round(raw * 2) / 2
}

export const toLb = (weight: number, unit: Unit) => (unit === 'lb' ? weight : weight * LB_PER_KG)
