import Dexie, { type EntityTable } from 'dexie'
import type {
  Exercise,
  Session,
  SessionExercise,
  Setting,
  Template,
  TemplateExercise,
  WorkoutSet,
} from './types.ts'

/** Bump when the stores below change, and add a new db.version(n) block. Also written into JSON exports. */
export const SCHEMA_VERSION = 1

export type LiftLogDB = Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  templates: EntityTable<Template, 'id'>
  templateExercises: EntityTable<TemplateExercise, 'id'>
  sessions: EntityTable<Session, 'id'>
  sessionExercises: EntityTable<SessionExercise, 'id'>
  sets: EntityTable<WorkoutSet, 'id'>
  settings: EntityTable<Setting, 'key'>
}

export const db = new Dexie('liftlog') as LiftLogDB

// Only indexed fields are listed; other fields are stored but not indexed.
db.version(1).stores({
  exercises: 'id, name, muscleGroup, equipment',
  templates: 'id, dayOfWeek, order',
  templateExercises: 'id, templateId, exerciseId, [templateId+order]',
  sessions: 'id, templateId, startedAt, endedAt',
  sessionExercises: 'id, sessionId, exerciseId, [sessionId+order]',
  sets: 'id, sessionId, sessionExerciseId, exerciseId, completedAt',
  settings: 'key',
})

export const newId = () => crypto.randomUUID()
