import { db, newId } from './db.ts'
import { defaultIncrements } from './exercises.ts'
import { EXERCISE_SEEDS } from './seedExercises.ts'
import { TEMPLATE_SEEDS } from './seedTemplates.ts'
import type { Equipment, Exercise, MuscleGroup, TemplateExercise } from './types.ts'

const EXERCISE_SEED_KEY = 'seed:exercises'
const TEMPLATE_SEED_KEY = 'seed:templates'

async function appliedVersion(key: string): Promise<number> {
  return ((await db.settings.get(key))?.value as number | undefined) ?? 0
}

/**
 * Adds any seed data this install hasn't applied yet. Safe to call on every
 * launch: applied versions are recorded in settings, and names already present
 * (including the user's custom or renamed exercises) are never duplicated.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction(
    'rw',
    [db.exercises, db.settings, db.templates, db.templateExercises],
    async () => {
      const now = Date.now()
      await seedExercises(now)
      await seedTemplates(now)
    },
  )
}

async function seedExercises(now: number) {
  const applied = await appliedVersion(EXERCISE_SEED_KEY)
  const pending = EXERCISE_SEEDS.filter((s) => s.version > applied)
  if (pending.length === 0) return

  const existing = new Set((await db.exercises.toArray()).map((e) => e.name.toLowerCase()))
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
    key: EXERCISE_SEED_KEY,
    value: Math.max(...EXERCISE_SEEDS.map((s) => s.version)),
    updatedAt: now,
  })
}

/** Runs once per install. Deleting or editing a seeded template never brings it back. */
async function seedTemplates(now: number) {
  if ((await appliedVersion(TEMPLATE_SEED_KEY)) >= 1) return

  const byName = new Map((await db.exercises.toArray()).map((e) => [e.name.toLowerCase(), e]))
  let order = await db.templates.count()

  for (const seed of TEMPLATE_SEEDS) {
    const templateId = newId()
    await db.templates.add({
      id: templateId,
      name: seed.name,
      dayOfWeek: seed.dayOfWeek,
      order: order++,
      updatedAt: now,
    })
    const rows: TemplateExercise[] = []
    for (const [name, targetSets, repMin, repMax, restSeconds] of seed.exercises) {
      // Skipped only if the user already renamed that library exercise.
      const exercise = byName.get(name.toLowerCase())
      if (!exercise) continue
      rows.push({
        id: newId(),
        templateId,
        exerciseId: exercise.id,
        order: rows.length,
        targetSets,
        repMin,
        repMax,
        restSeconds,
        updatedAt: now,
      })
    }
    await db.templateExercises.bulkAdd(rows)
  }

  await db.settings.put({ key: TEMPLATE_SEED_KEY, value: 1, updatedAt: now })
}
