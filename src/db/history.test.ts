import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.ts'
import { getExerciseHistory, listLoggedExercises, listSessions } from './history.ts'
import { ensureSeeded } from './seed.ts'
import {
  addSet,
  deleteSet,
  finishSession,
  loadWorkout,
  setCompleted,
  startSession,
  updateSession,
  updateSet,
} from './sessions.ts'

const tick = () => new Promise((r) => setTimeout(r, 3))
const legsId = async () => (await db.templates.where('dayOfWeek').equals(2).first())!.id

/** One finished Legs session: Smith Squat 3 sets at `weight` × `reps`, Leg Press 1 set of 300 × 10. */
async function logSession(weight: number, reps: number) {
  const session = await startSession(await legsId())
  const { cards } = (await loadWorkout(session.id))!
  for (const s of cards[0].sets) {
    await updateSet(s.id, { weight, reps })
    await setCompleted(s.id, true)
    await tick()
  }
  await updateSet(cards[1].sets[0].id, { weight: 300, reps: 10 })
  await setCompleted(cards[1].sets[0].id, true)
  await finishSession(session.id)
  await tick()
  return session.id
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await ensureSeeded()
})

describe('history', () => {
  it('lists finished sessions newest first with totals, and skips the one in progress', async () => {
    const first = await logSession(100, 10)
    const second = await logSession(110, 8)
    await startSession(await legsId()) // in progress

    const { unit, items } = await listSessions()
    expect(unit).toBe('lb')
    expect(items.map((i) => i.session.id)).toEqual([second, first])
    expect(items[1]).toMatchObject({
      templateName: 'Legs',
      setCount: 4,
      exerciseCount: 2,
      volume: 100 * 10 * 3 + 300 * 10,
    })
  })

  it('shows per-exercise history with the best estimated 1RM per session', async () => {
    await logSession(100, 10)
    await logSession(110, 8)
    const squat = (await db.exercises.where('name').equals('Smith Squat').first())!
    const { exercise, entries } = await getExerciseHistory(squat.id)
    expect(exercise!.name).toBe('Smith Squat')
    expect(entries.map((e) => e.sets.map((s) => [s.weight, s.reps]))).toEqual([
      [[110, 8], [110, 8], [110, 8]],
      [[100, 10], [100, 10], [100, 10]],
    ])
    expect(entries[0].e1rm).toBeCloseTo(110 * (1 + 8 / 30))
    expect(entries[1].e1rm).toBeCloseTo(100 * (1 + 10 / 30))
  })

  it('lists only exercises that have been logged, most recent first', async () => {
    await logSession(100, 10)
    const logged = await listLoggedExercises()
    expect(logged.map((l) => [l.exercise.name, l.sessionCount]).sort()).toEqual([
      ['Leg Press', 1],
      ['Smith Squat', 1],
    ])
  })
})

describe('editing a past session', () => {
  it('edits a set, and the change flows into history and the next suggestion', async () => {
    const id = await logSession(200, 10)
    const { cards } = (await loadWorkout(id))!
    for (const s of cards[0].sets) await updateSet(s.id, { reps: 12 }) // "actually I got 12s"

    const next = await startSession(await legsId())
    expect((await loadWorkout(next.id))!.cards[0].suggestion).toMatchObject({
      kind: 'increase',
      weight: 210,
    })
  })

  it('adds a set as completed, and deletes sets (removing the card when it empties)', async () => {
    const id = await logSession(100, 10)
    let { cards } = (await loadWorkout(id))!
    await addSet(cards[0].card.id, true)
    ;({ cards } = (await loadWorkout(id))!)
    expect(cards[0].sets).toHaveLength(4)
    expect(cards[0].sets[3]).toMatchObject({ weight: 100, reps: 10, completed: true })
    expect(cards[0].sets[3].completedAt).toBeTypeOf('number')

    await deleteSet(cards[0].sets[3].id)
    await deleteSet(cards[1].sets[0].id) // Leg Press's only set
    ;({ cards } = (await loadWorkout(id))!)
    expect(cards.map((c) => [c.exercise!.name, c.sets.length])).toEqual([['Smith Squat', 3]])
  })

  it('edits notes and times', async () => {
    const id = await logSession(100, 10)
    const startedAt = new Date(2026, 10, 3, 18, 30).getTime()
    await updateSession(id, { notes: 'Felt strong', startedAt, endedAt: startedAt + 55 * 60_000 })
    const { items } = await listSessions()
    expect(items[0].session.notes).toBe('Felt strong')
    expect(items[0].durationMs).toBe(55 * 60_000)
  })
})
