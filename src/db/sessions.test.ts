import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.ts'
import { ensureSeeded } from './seed.ts'
import {
  addSessionExercise,
  addSet,
  discardSession,
  finishSession,
  getActiveSession,
  getSessionSummary,
  loadWorkout,
  moveSessionExercise,
  removeLastSet,
  removeSessionExercise,
  setCompleted,
  startSession,
  swapSessionExercise,
  templateListsExercise,
  updateSet,
} from './sessions.ts'
import { listTemplateExercises } from './templates.ts'

const tick = () => new Promise((r) => setTimeout(r, 3))
const exerciseId = async (name: string) =>
  (await db.exercises.where('name').equals(name).first())!.id
const legsId = async () => (await db.templates.where('dayOfWeek').equals(2).first())!.id
const load = async (sessionId: string) => (await loadWorkout(sessionId))!
const cardNames = async (sessionId: string) =>
  (await load(sessionId)).cards.map((c) => c.exercise!.name)

/** Logs every set of the first `cards` cards at the given weight × reps, then finishes. */
async function logAndFinish(sessionId: string, weight: number, reps: number, cards = 1) {
  const workout = await load(sessionId)
  for (const { sets } of workout.cards.slice(0, cards)) {
    for (const s of sets) {
      await updateSet(s.id, { weight, reps })
      await setCompleted(s.id, true)
      await tick()
    }
  }
  await finishSession(sessionId)
  await tick()
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await ensureSeeded()
})

describe('starting a workout', () => {
  it('copies the template into cards with blank sets when there is no history', async () => {
    const session = await startSession(await legsId())
    const { cards, templateName, unit } = await load(session.id)
    expect(templateName).toBe('Legs')
    expect(unit).toBe('lb')
    expect(cards.map((c) => c.exercise!.name)).toEqual([
      'Smith Squat',
      'Leg Press',
      'Dumbbell Romanian Deadlift',
      'Leg Extension',
      'Seated Leg Curl',
      'Smith Calf Raise',
    ])
    expect(cards[0].card).toMatchObject({ targetSets: 3, repMin: 8, repMax: 12, restSeconds: 150 })
    expect(cards[0].sets).toHaveLength(3)
    expect(cards[0].sets[0]).toMatchObject({ weight: null, reps: null, completed: false, unit: 'lb' })
    expect(cards[0].previous).toEqual([])
  })

  it('only ever has one workout in progress', async () => {
    const first = await startSession(await legsId())
    const second = await startSession(null)
    expect(second.id).toBe(first.id)
    expect((await getActiveSession())!.id).toBe(first.id)
    expect(await db.sessions.count()).toBe(1)
  })

  it('starts an empty workout with no cards', async () => {
    const session = await startSession(null)
    expect((await load(session.id)).cards).toEqual([])
  })

  it('snapshots targets, so editing the template mid-workout does not change the session', async () => {
    const templateId = await legsId()
    const session = await startSession(templateId)
    const [row] = await listTemplateExercises(templateId)
    await db.templateExercises.update(row.id, { restSeconds: 30, targetSets: 5 })
    expect((await load(session.id)).cards[0].card).toMatchObject({ restSeconds: 150, targetSets: 3 })
  })
})

describe('ghost values and pre-fill', () => {
  it('shows last session as ghosts and pre-fills the new sets from it', async () => {
    const first = await startSession(await legsId())
    const [a, b, c] = (await load(first.id)).cards[0].sets
    for (const [set, weight, reps] of [[a, 135, 10], [b, 135, 9], [c, 125, 8]] as const) {
      await updateSet(set.id, { weight, reps })
      await setCompleted(set.id, true)
      await tick()
    }
    await finishSession(first.id)
    await tick()

    const second = await startSession(await legsId())
    const { cards } = await load(second.id)
    expect(cards[0].previous.map((s) => [s.weight, s.reps])).toEqual([[135, 10], [135, 9], [125, 8]])
    expect(cards[0].sets.map((s) => [s.weight, s.reps, s.completed])).toEqual([
      [135, 10, false],
      [135, 9, false],
      [125, 8, false],
    ])
    expect(cards[1].sets[0]).toMatchObject({ weight: null, reps: null }) // Leg Press: never logged
  })

  it('ignores unfinished and unchecked work when looking for the previous session', async () => {
    const first = await startSession(await legsId())
    await logAndFinish(first.id, 100, 10)

    const second = await startSession(await legsId())
    const [set] = (await load(second.id)).cards[0].sets
    await updateSet(set.id, { weight: 999, reps: 1 }) // typed but never checked off
    await discardSession(second.id)

    const third = await startSession(await legsId())
    expect((await load(third.id)).cards[0].previous[0]).toMatchObject({ weight: 100, reps: 10 })
  })

  it('converts a previous kg session when pre-filling in lb', async () => {
    await db.settings.put({ key: 'unit', value: 'kg', updatedAt: 0 })
    const first = await startSession(await legsId())
    await logAndFinish(first.id, 60, 10)
    await db.settings.put({ key: 'unit', value: 'lb', updatedAt: 0 })

    const second = await startSession(await legsId())
    const { cards } = await load(second.id)
    expect(cards[0].previous[0]).toMatchObject({ weight: 60, unit: 'kg' })
    expect(cards[0].sets[0]).toMatchObject({ weight: 132.5, unit: 'lb', reps: 10 })
  })
})

describe('editing during a workout', () => {
  it('checks and unchecks a set', async () => {
    const session = await startSession(await legsId())
    const [set] = (await load(session.id)).cards[0].sets
    await setCompleted(set.id, true)
    expect((await db.sets.get(set.id))!.completedAt).toBeTypeOf('number')
    await setCompleted(set.id, false)
    expect(await db.sets.get(set.id)).toMatchObject({ completed: false, completedAt: null })
  })

  it('adds a set copying the one above, and removes the last set', async () => {
    const session = await startSession(await legsId())
    const { card, sets } = (await load(session.id)).cards[0]
    await updateSet(sets[2].id, { weight: 150, reps: 8 })
    await setCompleted(sets[2].id, true)
    await addSet(card.id)
    let after = (await load(session.id)).cards[0].sets
    expect(after).toHaveLength(4)
    expect(after[3]).toMatchObject({ weight: 150, reps: 8, completed: false, order: 3 })
    await removeLastSet(card.id)
    after = (await load(session.id)).cards[0].sets
    expect(after).toHaveLength(3)
    expect(after[2].completed).toBe(true)
  })

  it('adds, reorders and removes exercises', async () => {
    const session = await startSession(await legsId())
    await addSessionExercise(session.id, await exerciseId('Hack Squat Machine'))
    let workout = await load(session.id)
    const added = workout.cards.at(-1)!
    expect(added.exercise!.name).toBe('Hack Squat Machine')
    expect(added.sets).toHaveLength(3)

    await moveSessionExercise(added.card.id, -1)
    expect((await cardNames(session.id)).slice(-2)).toEqual(['Hack Squat Machine', 'Smith Calf Raise'])
    await moveSessionExercise(workout.cards[0].card.id, -1) // already first: no change
    expect((await cardNames(session.id))[0]).toBe('Smith Squat')

    await removeSessionExercise(added.card.id)
    workout = await load(session.id)
    expect(workout.cards).toHaveLength(6)
    expect(await db.sets.where('sessionExerciseId').equals(added.card.id).count()).toBe(0)
  })
})

describe('swapping an exercise', () => {
  it('replaces the card in place when nothing is logged, for today only', async () => {
    const templateId = await legsId()
    const session = await startSession(templateId)
    const { card } = (await load(session.id)).cards[0]
    expect(await templateListsExercise(session.id, card.exerciseId)).toBe(true)

    await swapSessionExercise(card.id, await exerciseId('Hack Squat Machine'), false)
    const workout = await load(session.id)
    expect(workout.cards).toHaveLength(6)
    expect(workout.cards[0].exercise!.name).toBe('Hack Squat Machine')
    expect(workout.cards[0].sets).toHaveLength(3)
    expect(workout.cards[0].sets.every((s) => s.exerciseId === workout.cards[0].card.exerciseId)).toBe(true)
    const names = (await db.exercises.bulkGet((await listTemplateExercises(templateId)).map((r) => r.exerciseId))).map((e) => e!.name)
    expect(names[0]).toBe('Smith Squat') // template untouched
  })

  it('keeps logged sets with the original exercise and puts the rest on a new card', async () => {
    const session = await startSession(await legsId())
    const { card, sets } = (await load(session.id)).cards[0]
    await updateSet(sets[0].id, { weight: 135, reps: 10 })
    await setCompleted(sets[0].id, true)

    await swapSessionExercise(card.id, await exerciseId('Hack Squat Machine'), false)
    const workout = await load(session.id)
    expect(workout.cards.map((c) => c.exercise!.name).slice(0, 3)).toEqual([
      'Smith Squat',
      'Hack Squat Machine',
      'Leg Press',
    ])
    expect(workout.cards.map((c) => c.card.order)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(workout.cards[0].sets.map((s) => [s.weight, s.reps, s.completed])).toEqual([[135, 10, true]])
    expect(workout.cards[1].sets).toHaveLength(2)
    expect(workout.cards[1].card).toMatchObject({ repMin: 8, repMax: 12, restSeconds: 150 })
  })

  it('can also update the template', async () => {
    const templateId = await legsId()
    const session = await startSession(templateId)
    const { card } = (await load(session.id)).cards[1]
    const hack = await exerciseId('Hack Squat Machine')
    await swapSessionExercise(card.id, hack, true)

    const rows = await listTemplateExercises(templateId)
    expect(rows[1]).toMatchObject({ exerciseId: hack, repMin: 10, repMax: 12, restSeconds: 120 })
    expect(rows).toHaveLength(6)
    expect(await templateListsExercise(session.id, card.exerciseId)).toBe(false)
  })
})

describe('finishing', () => {
  it('drops unchecked sets and untouched exercises, and summarises the session', async () => {
    const session = await startSession(await legsId())
    const { cards } = await load(session.id)
    await updateSet(cards[0].sets[0].id, { weight: 100, reps: 10 })
    await setCompleted(cards[0].sets[0].id, true)
    await updateSet(cards[0].sets[1].id, { weight: 100, reps: 8 })
    await setCompleted(cards[0].sets[1].id, true)
    await updateSet(cards[2].sets[0].id, { weight: 40, reps: 12 })
    await setCompleted(cards[2].sets[0].id, true)
    await updateSet(cards[1].sets[0].id, { weight: 300, reps: 10 }) // typed, not checked

    expect(await finishSession(session.id)).toBe(true)
    expect(await getActiveSession()).toBeUndefined()

    const after = await load(session.id)
    expect(after.cards.map((c) => [c.exercise!.name, c.sets.length, c.card.order])).toEqual([
      ['Smith Squat', 2, 0],
      ['Dumbbell Romanian Deadlift', 1, 1],
    ])
    const summary = (await getSessionSummary(session.id))!
    expect(summary).toMatchObject({ setCount: 3, exerciseCount: 2, volume: 100 * 18 + 40 * 12 })
    expect(summary.durationMs).toBeGreaterThanOrEqual(0)
    expect(summary.prs).toEqual([]) // first time logging: baseline, not a PR
  })

  it('deletes the session entirely if nothing was checked off', async () => {
    const session = await startSession(await legsId())
    expect(await finishSession(session.id)).toBe(false)
    expect(await db.sessions.count()).toBe(0)
    expect(await db.sets.count()).toBe(0)
    expect(await db.sessionExercises.count()).toBe(0)
  })

  it('discarding removes the session and all its rows', async () => {
    const session = await startSession(await legsId())
    const [set] = (await load(session.id)).cards[0].sets
    await setCompleted(set.id, true)
    await discardSession(session.id)
    expect(await db.sessions.count()).toBe(0)
    expect(await db.sets.count()).toBe(0)
  })

  it('reports a PR when the best estimated 1RM beats every earlier session', async () => {
    const first = await startSession(await legsId())
    await logAndFinish(first.id, 100, 10, 2)

    const second = await startSession(await legsId())
    const { cards } = await load(second.id)
    await updateSet(cards[0].sets[0].id, { weight: 105, reps: 10 }) // better
    await setCompleted(cards[0].sets[0].id, true)
    await updateSet(cards[1].sets[0].id, { weight: 100, reps: 10 }) // same as before
    await setCompleted(cards[1].sets[0].id, true)
    await finishSession(second.id)

    const { prs } = (await getSessionSummary(second.id))!
    expect(prs).toHaveLength(1)
    expect(prs[0].exercise!.name).toBe('Smith Squat')
    expect(prs[0].set).toMatchObject({ weight: 105, reps: 10 })
    expect(prs[0].e1rm).toBeCloseTo(140)
  })
})
