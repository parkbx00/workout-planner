import { bestSet, totalVolume } from '../lib/stats.ts'
import { convertWeight } from '../lib/units.ts'
import { db, newId } from './db.ts'
import { listTemplateExercises, TEMPLATE_EXERCISE_DEFAULTS } from './templates.ts'
import type { Exercise, Session, SessionExercise, Unit, WorkoutSet } from './types.ts'

const TABLES = [db.sessions, db.sessionExercises, db.sets, db.templateExercises, db.settings]

export async function getUnit(): Promise<Unit> {
  return ((await db.settings.get('unit'))?.value as Unit | undefined) ?? 'lb'
}

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.filter((s) => s.endedAt === null).first()
}

const bySetOrder = (a: WorkoutSet, b: WorkoutSet) => a.order - b.order

function listCards(sessionId: string): Promise<SessionExercise[]> {
  return db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order')
}

async function listCardSets(sessionExerciseId: string): Promise<WorkoutSet[]> {
  const sets = await db.sets.where('sessionExerciseId').equals(sessionExerciseId).toArray()
  return sets.sort(bySetOrder)
}

/**
 * Completed sets for this exercise from the most recent finished session
 * (other than `excludeSessionId`), in the order they were done.
 */
export async function getPreviousSets(
  exerciseId: string,
  excludeSessionId: string,
): Promise<WorkoutSet[]> {
  const sets = await db.sets
    .where('exerciseId')
    .equals(exerciseId)
    .filter((s) => s.completed && s.sessionId !== excludeSessionId)
    .toArray()
  if (sets.length === 0) return []

  const sessions = await db.sessions.bulkGet([...new Set(sets.map((s) => s.sessionId))])
  let latest: Session | undefined
  for (const s of sessions) {
    if (s && s.endedAt !== null && (!latest || s.startedAt > latest.startedAt)) latest = s
  }
  if (!latest) return []
  const latestId = latest.id
  return sets
    .filter((s) => s.sessionId === latestId)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0) || a.order - b.order)
}

/** New unchecked sets, pre-filled from the previous session so a set that goes to plan is one tap. */
async function makeSets(card: SessionExercise, count: number, startOrder = 0): Promise<void> {
  const unit = await getUnit()
  const previous = await getPreviousSets(card.exerciseId, card.sessionId)
  const now = Date.now()
  const rows: WorkoutSet[] = Array.from({ length: count }, (_, i) => {
    const p = previous[i] ?? previous.at(-1)
    return {
      id: newId(),
      sessionId: card.sessionId,
      sessionExerciseId: card.id,
      exerciseId: card.exerciseId,
      order: startOrder + i,
      weight: p && p.weight !== null ? convertWeight(p.weight, p.unit, unit) : null,
      unit,
      reps: p?.reps ?? null,
      completed: false,
      completedAt: null,
      updatedAt: now,
    }
  })
  await db.sets.bulkAdd(rows)
}

/** Starts a workout from a template (or empty). If one is already in progress, returns that instead. */
export function startSession(templateId: string | null): Promise<Session> {
  return db.transaction('rw', TABLES, async () => {
    const active = await getActiveSession()
    if (active) return active

    const now = Date.now()
    const session: Session = {
      id: newId(),
      templateId,
      startedAt: now,
      endedAt: null,
      notes: '',
      updatedAt: now,
    }
    await db.sessions.add(session)

    const rows = templateId ? await listTemplateExercises(templateId) : []
    for (const [order, row] of rows.entries()) {
      const card: SessionExercise = {
        id: newId(),
        sessionId: session.id,
        exerciseId: row.exerciseId,
        order,
        targetSets: row.targetSets,
        repMin: row.repMin,
        repMax: row.repMax,
        restSeconds: row.restSeconds,
        updatedAt: now,
      }
      await db.sessionExercises.add(card)
      await makeSets(card, row.targetSets)
    }
    return session
  })
}

export async function updateSet(
  id: string,
  patch: Partial<Pick<WorkoutSet, 'weight' | 'reps'>>,
): Promise<void> {
  await db.sets.update(id, { ...patch, updatedAt: Date.now() })
}

export async function setCompleted(id: string, completed: boolean): Promise<void> {
  const now = Date.now()
  await db.sets.update(id, { completed, completedAt: completed ? now : null, updatedAt: now })
}

/** Adds a set to the card, copying the weight and reps of the set above it. */
export function addSet(sessionExerciseId: string): Promise<void> {
  return db.transaction('rw', TABLES, async () => {
    const card = await db.sessionExercises.get(sessionExerciseId)
    if (!card) return
    const last = (await listCardSets(card.id)).at(-1)
    if (!last) return makeSets(card, 1)
    await db.sets.add({
      ...last,
      id: newId(),
      order: last.order + 1,
      completed: false,
      completedAt: null,
      updatedAt: Date.now(),
    })
  })
}

export function removeLastSet(sessionExerciseId: string): Promise<void> {
  return db.transaction('rw', TABLES, async () => {
    const last = (await listCardSets(sessionExerciseId)).at(-1)
    if (last) await db.sets.delete(last.id)
  })
}

export function addSessionExercise(sessionId: string, exerciseId: string): Promise<void> {
  return db.transaction('rw', TABLES, async () => {
    const cards = await listCards(sessionId)
    const card: SessionExercise = {
      id: newId(),
      sessionId,
      exerciseId,
      order: (cards.at(-1)?.order ?? -1) + 1,
      ...TEMPLATE_EXERCISE_DEFAULTS,
      updatedAt: Date.now(),
    }
    await db.sessionExercises.add(card)
    await makeSets(card, card.targetSets)
  })
}

export function removeSessionExercise(sessionExerciseId: string): Promise<void> {
  return db.transaction('rw', TABLES, async () => {
    await db.sets.where('sessionExerciseId').equals(sessionExerciseId).delete()
    await db.sessionExercises.delete(sessionExerciseId)
  })
}

export function moveSessionExercise(sessionExerciseId: string, direction: -1 | 1): Promise<void> {
  return db.transaction('rw', TABLES, async () => {
    const card = await db.sessionExercises.get(sessionExerciseId)
    if (!card) return
    const cards = await listCards(card.sessionId)
    const from = cards.findIndex((c) => c.id === card.id)
    const to = from + direction
    if (to < 0 || to >= cards.length) return
    ;[cards[from], cards[to]] = [cards[to], cards[from]]
    const now = Date.now()
    for (const [order, c] of cards.entries()) {
      if (c.order !== order) await db.sessionExercises.update(c.id, { order, updatedAt: now })
    }
  })
}

/** True if the session came from a template that still lists this exercise (so a swap can offer to update it). */
export async function templateListsExercise(
  sessionId: string,
  exerciseId: string,
): Promise<boolean> {
  const session = await db.sessions.get(sessionId)
  if (!session?.templateId) return false
  const rows = await listTemplateExercises(session.templateId)
  return rows.some((r) => r.exerciseId === exerciseId)
}

/**
 * Swaps the exercise on a card. Sets already checked off stay with the original
 * exercise: that card keeps them, and the new exercise gets its own card right
 * after it with the remaining sets. With nothing logged yet, the card is replaced in place.
 */
export function swapSessionExercise(
  sessionExerciseId: string,
  newExerciseId: string,
  alsoUpdateTemplate: boolean,
): Promise<void> {
  return db.transaction('rw', TABLES, async () => {
    const card = await db.sessionExercises.get(sessionExerciseId)
    if (!card || card.exerciseId === newExerciseId) return
    const now = Date.now()

    if (alsoUpdateTemplate) {
      const session = await db.sessions.get(card.sessionId)
      const row = session?.templateId
        ? (await listTemplateExercises(session.templateId)).find(
            (r) => r.exerciseId === card.exerciseId,
          )
        : undefined
      if (row) {
        await db.templateExercises.update(row.id, { exerciseId: newExerciseId, updatedAt: now })
      }
    }

    const sets = await listCardSets(card.id)
    const done = sets.filter((s) => s.completed)
    await db.sets.bulkDelete(sets.filter((s) => !s.completed).map((s) => s.id))

    if (done.length === 0) {
      const replaced = { ...card, exerciseId: newExerciseId, updatedAt: now }
      await db.sessionExercises.put(replaced)
      await makeSets(replaced, card.targetSets)
      return
    }

    await db.sessionExercises.update(card.id, { targetSets: done.length, updatedAt: now })
    for (const later of await listCards(card.sessionId)) {
      if (later.order > card.order) {
        await db.sessionExercises.update(later.id, { order: later.order + 1, updatedAt: now })
      }
    }
    const added: SessionExercise = {
      ...card,
      id: newId(),
      exerciseId: newExerciseId,
      order: card.order + 1,
      targetSets: Math.max(1, card.targetSets - done.length),
      updatedAt: now,
    }
    await db.sessionExercises.add(added)
    await makeSets(added, added.targetSets)
  })
}

async function deleteSession(sessionId: string) {
  await db.sets.where('sessionId').equals(sessionId).delete()
  await db.sessionExercises.where('sessionId').equals(sessionId).delete()
  await db.sessions.delete(sessionId)
}

export function discardSession(sessionId: string): Promise<void> {
  return db.transaction('rw', TABLES, () => deleteSession(sessionId))
}

/**
 * Ends the workout. Unchecked sets and exercises with nothing checked are dropped.
 * Returns false (and deletes the session) if nothing at all was logged.
 */
export function finishSession(sessionId: string): Promise<boolean> {
  return db.transaction('rw', TABLES, async () => {
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray()
    const done = sets.filter((s) => s.completed)
    if (done.length === 0) {
      await deleteSession(sessionId)
      return false
    }
    await db.sets.bulkDelete(sets.filter((s) => !s.completed).map((s) => s.id))
    const kept = new Set(done.map((s) => s.sessionExerciseId))
    const now = Date.now()
    for (const [i, card] of (await listCards(sessionId)).filter((c) => kept.has(c.id)).entries()) {
      if (card.order !== i) await db.sessionExercises.update(card.id, { order: i, updatedAt: now })
    }
    for (const card of await listCards(sessionId)) {
      if (!kept.has(card.id)) await db.sessionExercises.delete(card.id)
    }
    await db.sessions.update(sessionId, { endedAt: now, updatedAt: now })
    return true
  })
}

export interface WorkoutCard {
  card: SessionExercise
  exercise: Exercise | undefined
  sets: WorkoutSet[]
  /** Last session's completed sets for this exercise (the "ghost" values). */
  previous: WorkoutSet[]
}

export interface Workout {
  session: Session
  templateName: string | null
  unit: Unit
  cards: WorkoutCard[]
}

export async function loadWorkout(sessionId: string): Promise<Workout | null> {
  const session = await db.sessions.get(sessionId)
  if (!session) return null
  const [template, unit, cards, sets] = await Promise.all([
    session.templateId ? db.templates.get(session.templateId) : undefined,
    getUnit(),
    listCards(sessionId),
    db.sets.where('sessionId').equals(sessionId).toArray(),
  ])
  const exercises = await db.exercises.bulkGet(cards.map((c) => c.exerciseId))
  const previous = await Promise.all(cards.map((c) => getPreviousSets(c.exerciseId, sessionId)))
  return {
    session,
    templateName: template?.name ?? null,
    unit,
    cards: cards.map((card, i) => ({
      card,
      exercise: exercises[i],
      sets: sets.filter((s) => s.sessionExerciseId === card.id).sort(bySetOrder),
      previous: previous[i],
    })),
  }
}

export interface SessionSummary {
  session: Session
  templateName: string | null
  unit: Unit
  durationMs: number
  setCount: number
  exerciseCount: number
  volume: number
  /** Exercises whose best estimated 1RM this session beat every earlier session. */
  prs: { exercise: Exercise | undefined; set: WorkoutSet; e1rm: number }[]
}

export async function getSessionSummary(sessionId: string): Promise<SessionSummary | null> {
  const workout = await loadWorkout(sessionId)
  if (!workout) return null
  const { session, unit } = workout
  const done = workout.cards.flatMap((c) => c.sets).filter((s) => s.completed)

  const prs: SessionSummary['prs'] = []
  const seen = new Set<string>()
  for (const { card, exercise } of workout.cards) {
    if (seen.has(card.exerciseId)) continue
    seen.add(card.exerciseId)
    const best = bestSet(done.filter((s) => s.exerciseId === card.exerciseId))
    if (!best) continue

    const others = await db.sets
      .where('exerciseId')
      .equals(card.exerciseId)
      .filter((s) => s.completed && s.sessionId !== sessionId)
      .toArray()
    const sessions = await db.sessions.bulkGet([...new Set(others.map((s) => s.sessionId))])
    const earlier = new Set(
      sessions.filter((s) => s && s.startedAt < session.startedAt).map((s) => s!.id),
    )
    const before = bestSet(others.filter((s) => earlier.has(s.sessionId)))
    // The first time an exercise is logged sets the baseline; it isn't a PR.
    if (before && best.e1rmLb > before.e1rmLb + 1e-9) {
      prs.push({
        exercise,
        set: best.set,
        e1rm: unit === 'lb' ? best.e1rmLb : convertWeight(best.e1rmLb, 'lb', 'kg'),
      })
    }
  }

  return {
    session,
    templateName: workout.templateName,
    unit,
    durationMs: (session.endedAt ?? Date.now()) - session.startedAt,
    setCount: done.length,
    exerciseCount: new Set(done.map((s) => s.exerciseId)).size,
    volume: totalVolume(done, unit),
    prs,
  }
}
