import { weeklySetsByMuscle, type MuscleCounts } from '../lib/charts.ts'
import { bestSet, totalVolume } from '../lib/stats.ts'
import { LB_PER_KG } from '../lib/units.ts'
import { db } from './db.ts'
import { getUnit } from './sessions.ts'
import type { Exercise, Session, Unit, WorkoutSet } from './types.ts'

export interface SessionListItem {
  session: Session
  templateName: string | null
  durationMs: number
  setCount: number
  exerciseCount: number
  volume: number
}

/** Finished sessions, newest first. */
export async function listSessions(): Promise<{ unit: Unit; items: SessionListItem[] }> {
  const [unit, sessions, sets, templates] = await Promise.all([
    getUnit(),
    db.sessions.toArray(),
    db.sets.toArray(),
    db.templates.toArray(),
  ])
  const templateName = new Map(templates.map((t) => [t.id, t.name]))
  const bySession = new Map<string, WorkoutSet[]>()
  for (const s of sets) {
    if (!s.completed) continue
    const list = bySession.get(s.sessionId)
    if (list) list.push(s)
    else bySession.set(s.sessionId, [s])
  }

  const items = sessions
    .filter((s) => s.endedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((session) => {
      const own = bySession.get(session.id) ?? []
      return {
        session,
        templateName: session.templateId ? (templateName.get(session.templateId) ?? null) : null,
        durationMs: session.endedAt! - session.startedAt,
        setCount: own.length,
        exerciseCount: new Set(own.map((s) => s.exerciseId)).size,
        volume: totalVolume(own, unit),
      }
    })
  return { unit, items }
}

export interface ExerciseHistoryEntry {
  session: Session
  /** Completed sets in the order they were done. */
  sets: WorkoutSet[]
  /** Best estimated 1RM that day in the display unit, or null for bodyweight-only sets. */
  e1rm: number | null
}

/** Every finished session that includes this exercise, newest first. */
export async function getExerciseHistory(exerciseId: string): Promise<{
  exercise: Exercise | undefined
  unit: Unit
  entries: ExerciseHistoryEntry[]
}> {
  const [exercise, unit, sets] = await Promise.all([
    db.exercises.get(exerciseId),
    getUnit(),
    db.sets
      .where('exerciseId')
      .equals(exerciseId)
      .filter((s) => s.completed)
      .toArray(),
  ])
  const sessions = (await db.sessions.bulkGet([...new Set(sets.map((s) => s.sessionId))]))
    .filter((s): s is Session => s !== undefined && s.endedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt)

  const entries = sessions.map((session) => {
    const own = sets
      .filter((s) => s.sessionId === session.id)
      .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0) || a.order - b.order)
    const best = bestSet(own)
    return {
      session,
      sets: own,
      e1rm: best ? (unit === 'lb' ? best.e1rmLb : best.e1rmLb / LB_PER_KG) : null,
    }
  })
  return { exercise, unit, entries }
}

export interface LoggedExercise {
  exercise: Exercise
  sessionCount: number
  lastAt: number
}

/** Exercises that appear in at least one finished session, most recently trained first. */
export async function listLoggedExercises(): Promise<LoggedExercise[]> {
  const [sets, sessions, exercises] = await Promise.all([
    db.sets.filter((s) => s.completed).toArray(),
    db.sessions.toArray(),
    db.exercises.toArray(),
  ])
  const startedAt = new Map(sessions.filter((s) => s.endedAt !== null).map((s) => [s.id, s.startedAt]))
  const seen = new Map<string, Set<string>>()
  for (const s of sets) {
    if (!startedAt.has(s.sessionId)) continue
    const list = seen.get(s.exerciseId)
    if (list) list.add(s.sessionId)
    else seen.set(s.exerciseId, new Set([s.sessionId]))
  }
  return exercises
    .filter((e) => seen.has(e.id))
    .map((exercise) => {
      const ids = [...seen.get(exercise.id)!]
      return {
        exercise,
        sessionCount: ids.length,
        lastAt: Math.max(...ids.map((id) => startedAt.get(id)!)),
      }
    })
    .sort((a, b) => b.lastAt - a.lastAt)
}

/** Completed sets per muscle group for every week that has a finished workout. */
export async function getWeeklyMuscleSets(): Promise<Map<number, MuscleCounts>> {
  const [sets, sessions, exercises] = await Promise.all([
    db.sets.filter((s) => s.completed).toArray(),
    db.sessions.toArray(),
    db.exercises.toArray(),
  ])
  const startedAt = new Map(sessions.filter((s) => s.endedAt !== null).map((s) => [s.id, s.startedAt]))
  const muscle = new Map(exercises.map((e) => [e.id, e.muscleGroup]))
  return weeklySetsByMuscle(
    sets.flatMap((s) => {
      const t = startedAt.get(s.sessionId)
      const muscleGroup = muscle.get(s.exerciseId)
      return t !== undefined && muscleGroup ? [{ startedAt: t, muscleGroup }] : []
    }),
  )
}
