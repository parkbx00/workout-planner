import { db } from './db.ts'
import type { MuscleGroup, Unit } from './types.ts'

export const LOWER_BODY: readonly MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves']

export type BodyHalf = 'upper' | 'lower'
export const bodyHalf = (group: MuscleGroup): BodyHalf =>
  LOWER_BODY.includes(group) ? 'lower' : 'upper'

/** Default weight jumps for exercises that haven't been given their own. */
export interface IncrementDefaults {
  upper: { lb: number; kg: number }
  lower: { lb: number; kg: number }
}

export const FACTORY_INCREMENTS: IncrementDefaults = {
  upper: { lb: 5, kg: 2.5 },
  lower: { lb: 10, kg: 5 },
}
export const FACTORY_REST_SECONDS = 90
export const REST_LIMITS = [0, 600] as const

const incrementKey = (half: BodyHalf, unit: Unit) => `increment:${half}:${unit}`

async function read<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row === undefined ? fallback : (row.value as T)
}

function write(key: string, value: unknown) {
  return db.settings.put({ key, value, updatedAt: Date.now() })
}

export const getUnit = () => read<Unit>('unit', 'lb')
export const setUnit = (unit: Unit) => write('unit', unit)

export const getDefaultRestSeconds = () => read('defaultRestSeconds', FACTORY_REST_SECONDS)
export function setDefaultRestSeconds(seconds: number) {
  const clean = Math.min(REST_LIMITS[1], Math.max(REST_LIMITS[0], Math.round(seconds)))
  return write('defaultRestSeconds', clean)
}

export const getLastBackupAt = () => read<number | null>('lastBackupAt', null)
export const setLastBackupAt = (at: number) => write('lastBackupAt', at)

export async function getIncrementDefaults(): Promise<IncrementDefaults> {
  const f = FACTORY_INCREMENTS
  const [ul, uk, ll, lk] = await Promise.all([
    read(incrementKey('upper', 'lb'), f.upper.lb),
    read(incrementKey('upper', 'kg'), f.upper.kg),
    read(incrementKey('lower', 'lb'), f.lower.lb),
    read(incrementKey('lower', 'kg'), f.lower.kg),
  ])
  return { upper: { lb: ul, kg: uk }, lower: { lb: ll, kg: lk } }
}

/**
 * Changes a default increment and moves every exercise that was still on the
 * old default along with it. Exercises given their own increment keep it.
 * Returns how many exercises changed.
 */
export function setIncrementDefault(half: BodyHalf, unit: Unit, value: number): Promise<number> {
  if (!Number.isFinite(value) || value <= 0) {
    return Promise.reject(new RangeError('Increments must be greater than 0.'))
  }
  return db.transaction('rw', db.settings, db.exercises, async () => {
    const old = (await getIncrementDefaults())[half][unit]
    if (old === value) return 0
    const field = unit === 'lb' ? 'incrementLb' : 'incrementKg'
    const now = Date.now()
    const changed = await db.exercises
      .filter((e) => bodyHalf(e.muscleGroup) === half && e[field] === old)
      .modify({ [field]: value, updatedAt: now })
    await write(incrementKey(half, unit), value)
    return changed
  })
}
