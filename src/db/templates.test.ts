import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.ts'
import { ensureSeeded } from './seed.ts'
import { TEMPLATE_SEEDS } from './seedTemplates.ts'
import {
  addTemplateExercise,
  createTemplate,
  deleteTemplate,
  listTemplateExercises,
  removeTemplateExercise,
  reorderTemplateExercises,
  TEMPLATE_EXERCISE_DEFAULTS,
  updateTemplate,
  updateTemplateExercise,
} from './templates.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await ensureSeeded()
})

const names = async (templateId: string) => {
  const rows = await listTemplateExercises(templateId)
  const exercises = await db.exercises.bulkGet(rows.map((r) => r.exerciseId))
  return exercises.map((e) => e!.name)
}

describe('template seed', () => {
  it('builds Mon/Tue/Wed with every listed exercise found in the library, in order', async () => {
    const templates = await db.templates.orderBy('order').toArray()
    expect(templates.map((t) => [t.name, t.dayOfWeek])).toEqual([
      ['Chest / Shoulders', 1],
      ['Legs', 2],
      ['Back / Biceps', 3],
    ])
    for (const [i, seed] of TEMPLATE_SEEDS.entries()) {
      expect(await names(templates[i].id)).toEqual(seed.exercises.map((e) => e[0]))
    }
  })

  it('stores the per-exercise rep ranges and rest times from the seed', async () => {
    const legs = (await db.templates.where('dayOfWeek').equals(2).first())!
    const rows = await listTemplateExercises(legs.id)
    expect(rows[0]).toMatchObject({ targetSets: 3, repMin: 8, repMax: 12, restSeconds: 150 })
    expect(rows[3]).toMatchObject({ targetSets: 3, repMin: 12, repMax: 15, restSeconds: 90 })
  })

  it('tags the split exercises with the right muscle group, equipment and increments', async () => {
    const get = async (name: string) => (await db.exercises.where('name').equals(name).first())!
    expect(await get('Chest-Supported Row Machine')).toMatchObject({
      muscleGroup: 'back',
      equipment: 'machine',
      incrementLb: 5,
      incrementKg: 2.5,
    })
    expect(await get('Smith Incline Bench Press')).toMatchObject({
      muscleGroup: 'chest',
      equipment: 'smith',
      incrementLb: 5,
    })
    for (const name of ['Smith Squat', 'Leg Press', 'Dumbbell Romanian Deadlift', 'Smith Calf Raise']) {
      expect(await get(name)).toMatchObject({ incrementLb: 10, incrementKg: 5 })
    }
  })

  it('does not bring back a deleted template on the next launch', async () => {
    const legs = (await db.templates.where('dayOfWeek').equals(2).first())!
    await deleteTemplate(legs.id)
    await ensureSeeded()
    expect(await db.templates.count()).toBe(2)
    expect(await listTemplateExercises(legs.id)).toEqual([])
  })
})

describe('template editing', () => {
  it('creates a template at the end, and renames / reschedules it', async () => {
    const t = await createTemplate()
    expect(t.order).toBe(3)
    await updateTemplate(t.id, { name: '  Arms  ', dayOfWeek: 4 })
    expect(await db.templates.get(t.id)).toMatchObject({ name: 'Arms', dayOfWeek: 4 })
    await updateTemplate(t.id, { name: '   ', dayOfWeek: null })
    expect(await db.templates.get(t.id)).toMatchObject({ name: 'Arms', dayOfWeek: null })
  })

  it('adds an exercise at the end with default targets, and removes it', async () => {
    const t = await createTemplate('Arms')
    const curl = (await db.exercises.where('name').equals('Dumbbell Curl').first())!
    const dip = (await db.exercises.where('name').equals('Bench Dip').first())!
    await addTemplateExercise(t.id, curl.id)
    const second = await addTemplateExercise(t.id, dip.id)
    expect(second).toMatchObject({ order: 1, ...TEMPLATE_EXERCISE_DEFAULTS })
    await removeTemplateExercise(second.id)
    expect(await names(t.id)).toEqual(['Dumbbell Curl'])
  })

  it('edits targets, clamps them, and keeps repMin ≤ repMax', async () => {
    const t = await createTemplate('Arms')
    const curl = (await db.exercises.where('name').equals('Dumbbell Curl').first())!
    const { id } = await addTemplateExercise(t.id, curl.id)
    const read = async () => (await db.templateExercises.get(id))!

    await updateTemplateExercise(id, { targetSets: 4, restSeconds: 75 })
    expect(await read()).toMatchObject({ targetSets: 4, repMin: 8, repMax: 12, restSeconds: 75 })

    await updateTemplateExercise(id, { repMin: 15 }) // min above max pulls max up
    expect(await read()).toMatchObject({ repMin: 15, repMax: 15 })

    await updateTemplateExercise(id, { repMax: 6 }) // max below min pulls min down
    expect(await read()).toMatchObject({ repMin: 6, repMax: 6 })

    await updateTemplateExercise(id, { targetSets: 0, restSeconds: 9999, repMax: 500 })
    expect(await read()).toMatchObject({ targetSets: 1, restSeconds: 600, repMax: 100 })
  })

  it('reorders exercises', async () => {
    const legs = (await db.templates.where('dayOfWeek').equals(2).first())!
    const rows = await listTemplateExercises(legs.id)
    const moved = [rows[5], ...rows.slice(0, 5)]
    await reorderTemplateExercises(legs.id, moved.map((r) => r.id))
    expect((await names(legs.id))[0]).toBe('Smith Calf Raise')
    expect((await names(legs.id))[1]).toBe('Smith Squat')
    expect((await listTemplateExercises(legs.id)).map((r) => r.order)).toEqual([0, 1, 2, 3, 4, 5])
  })
})
