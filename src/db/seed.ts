import { db, newId } from './db.ts'
import { defaultIncrements } from './exercises.ts'
import { EXERCISE_SEEDS } from './seedExercises.ts'
import type { Equipment, Exercise, MuscleGroup } from './types.ts'

const SEED_KEY = 'seed:exercises'

/**
 * Adds any seed batches this install hasn't applied yet. Safe to call on every
 * launch: applied versions are recorded in settings, and names already present
 * (including the user's custom or renamed exercises) are never duplicated.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.exercises, db.settings, async () => {
    const applied = ((await db.settings.get(SEED_KEY))?.value as number | undefined) ?? 0
    const pending = EXERCISE_SEEDS.filter((s) => s.version > applied)
    if (pending.length === 0) return

    const existing = new Set((await db.exercises.toArray()).map((e) => e.name.toLowerCase()))
    const now = Date.now()
    const rows: Exercise[] = []

    for (const seed of pending) {
      for (const [muscleGroup, byEquipment] of Object.entries(seed.exercises)) {
        for (const [equipment, names] of Object.entries(byEquipment)) {
          for (const name of names) {
            if (existing.has(name.toLowerCase())) continue
            existing.add(name.toLowerCase())
            rows.push({
              id: newId(),
              name,
              muscleGroup: muscleGroup as MuscleGroup,
              equipment: equipment as Equipment,
              ...defaultIncrements(muscleGroup as MuscleGroup),
              isCustom: false,
              archived: false,
              updatedAt: now,
            })
          }
        }
      }
    }

    await db.exercises.bulkAdd(rows)
    await db.settings.put({
      key: SEED_KEY,
      value: Math.max(...EXERCISE_SEEDS.map((s) => s.version)),
      updatedAt: now,
    })
  })
}
