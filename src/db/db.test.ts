import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.ts'
import {
  createExercise,
  defaultIncrements,
  ExerciseValidationError,
  setExerciseArchived,
  updateExercise,
} from './exercises.ts'
import { ensureSeeded } from './seed.ts'
import { EQUIPMENT, MUSCLE_GROUPS } from './types.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('exercise seed', () => {
  it('seeds every muscle group with valid, uniquely named exercises', async () => {
    await ensureSeeded()
    const all = await db.exercises.toArray()

    expect(all.length).toBeGreaterThan(60)
    expect(new Set(all.map((e) => e.name.toLowerCase())).size).toBe(all.length)
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length)
    for (const group of MUSCLE_GROUPS) {
      expect(all.some((e) => e.muscleGroup === group)).toBe(true)
    }
    for (const e of all) {
      expect(EQUIPMENT).toContain(e.equipment)
      expect(e.isCustom).toBe(false)
      expect(e.archived).toBe(false)
      expect(e).toMatchObject(defaultIncrements(e.muscleGroup))
    }
  })

  it('is idempotent, including when two launches race', async () => {
    await Promise.all([ensureSeeded(), ensureSeeded()])
    const count = await db.exercises.count()
    await ensureSeeded()
    expect(await db.exercises.count()).toBe(count)
  })

  it('does not re-add a seeded exercise the user renamed or archived', async () => {
    await ensureSeeded()
    const legPress = (await db.exercises.where('name').equals('Leg Press').first())!
    await updateExercise(legPress.id, { ...legPress, name: 'Leg Press (wide)' })
    const count = await db.exercises.count()
    await ensureSeeded()
    expect(await db.exercises.count()).toBe(count)
  })
})

describe('exercise CRUD', () => {
  const input = {
    name: '  Landmine   Press ',
    muscleGroup: 'shoulders',
    equipment: 'machine',
    incrementLb: 5,
    incrementKg: 2.5,
  } as const

  it('creates a custom exercise with a trimmed name', async () => {
    const created = await createExercise(input)
    const stored = await db.exercises.get(created.id)
    expect(stored).toMatchObject({ name: 'Landmine Press', isCustom: true, archived: false })
    expect(stored!.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('rejects empty names, bad increments and duplicate names', async () => {
    await createExercise(input)
    await expect(createExercise({ ...input, name: ' ' })).rejects.toThrow(ExerciseValidationError)
    await expect(createExercise({ ...input, name: 'X', incrementLb: 0 })).rejects.toThrow(
      ExerciseValidationError,
    )
    await expect(createExercise({ ...input, name: 'landmine press' })).rejects.toThrow(
      /already exists/,
    )
  })

  it('edits without tripping the duplicate check on itself, and bumps updatedAt', async () => {
    const created = await createExercise(input)
    await new Promise((r) => setTimeout(r, 2))
    await updateExercise(created.id, { ...input, name: 'Landmine Press', incrementLb: 10 })
    const stored = (await db.exercises.get(created.id))!
    expect(stored.incrementLb).toBe(10)
    expect(stored.updatedAt).toBeGreaterThan(created.updatedAt)
  })

  it('archives and restores instead of deleting', async () => {
    const created = await createExercise(input)
    await setExerciseArchived(created.id, true)
    expect((await db.exercises.get(created.id))!.archived).toBe(true)
    await setExerciseArchived(created.id, false)
    expect((await db.exercises.get(created.id))!.archived).toBe(false)
  })
})
