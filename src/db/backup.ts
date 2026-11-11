import { epley1RM } from '../lib/stats.ts'
import { db, SCHEMA_VERSION } from './db.ts'
import { setLastBackupAt } from './settings.ts'
import type {
  Exercise,
  Session,
  SessionExercise,
  Setting,
  Template,
  TemplateExercise,
  WorkoutSet,
} from './types.ts'

export const BACKUP_APP = 'liftlog'
/** Not part of the data: it records when this device last made a backup. */
const LAST_BACKUP_KEY = 'lastBackupAt'
export const BACKUP_STALE_MS = 7 * 24 * 60 * 60 * 1000

export interface BackupData {
  exercises: Exercise[]
  templates: Template[]
  templateExercises: TemplateExercise[]
  sessions: Session[]
  sessionExercises: SessionExercise[]
  sets: WorkoutSet[]
  settings: Setting[]
}

export interface Backup {
  app: typeof BACKUP_APP
  /** Database schema version the data was exported from. */
  version: number
  exportedAt: number
  data: BackupData
}

const ALL_TABLES = [
  db.exercises,
  db.templates,
  db.templateExercises,
  db.sessions,
  db.sessionExercises,
  db.sets,
  db.settings,
]

/** Rows are sorted by primary key so two exports of the same data are identical. */
export function exportBackup(now = Date.now()): Promise<Backup> {
  return db.transaction('r', ALL_TABLES, async () => ({
    app: BACKUP_APP,
    version: SCHEMA_VERSION,
    exportedAt: now,
    data: {
      exercises: await db.exercises.toArray(),
      templates: await db.templates.toArray(),
      templateExercises: await db.templateExercises.toArray(),
      sessions: await db.sessions.toArray(),
      sessionExercises: await db.sessionExercises.toArray(),
      sets: await db.sets.toArray(),
      settings: (await db.settings.toArray()).filter((s) => s.key !== LAST_BACKUP_KEY),
    },
  }))
}

export const backupFileName = (ext: 'json' | 'csv', date = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `workouts-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.${ext}`
}

export const serializeBackup = (backup: Backup) => JSON.stringify(backup, null, 1)

export class BackupFormatError extends Error {}

type Check = 'string' | 'number' | 'boolean' | 'string?' | 'number?' | 'unit' | 'any'

const SHAPES: { [K in keyof BackupData]: Record<string, Check> } = {
  exercises: {
    id: 'string',
    name: 'string',
    muscleGroup: 'string',
    equipment: 'string',
    incrementLb: 'number',
    incrementKg: 'number',
    isCustom: 'boolean',
    archived: 'boolean',
    updatedAt: 'number',
  },
  templates: {
    id: 'string',
    name: 'string',
    dayOfWeek: 'number?',
    order: 'number',
    updatedAt: 'number',
  },
  templateExercises: {
    id: 'string',
    templateId: 'string',
    exerciseId: 'string',
    order: 'number',
    targetSets: 'number',
    repMin: 'number',
    repMax: 'number',
    restSeconds: 'number',
    updatedAt: 'number',
  },
  sessions: {
    id: 'string',
    templateId: 'string?',
    startedAt: 'number',
    endedAt: 'number?',
    notes: 'string',
    updatedAt: 'number',
  },
  sessionExercises: {
    id: 'string',
    sessionId: 'string',
    exerciseId: 'string',
    order: 'number',
    targetSets: 'number',
    repMin: 'number',
    repMax: 'number',
    restSeconds: 'number',
    updatedAt: 'number',
  },
  sets: {
    id: 'string',
    sessionId: 'string',
    sessionExerciseId: 'string',
    exerciseId: 'string',
    order: 'number',
    weight: 'number?',
    unit: 'unit',
    reps: 'number?',
    completed: 'boolean',
    completedAt: 'number?',
    updatedAt: 'number',
  },
  settings: { key: 'string', value: 'any', updatedAt: 'number' },
}

function matches(value: unknown, check: Check): boolean {
  switch (check) {
    case 'any':
      return value !== undefined
    case 'unit':
      return value === 'lb' || value === 'kg'
    case 'string?':
      return value === null || typeof value === 'string'
    case 'number?':
      return value === null || (typeof value === 'number' && Number.isFinite(value))
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    default:
      return typeof value === check
  }
}

/**
 * Checks that text is a Lift Log backup this version can restore. Throws
 * BackupFormatError with a message fit to show the user. Nothing is written.
 */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupFormatError("This file isn't valid JSON, so it can't be a Lift Log backup.")
  }
  const file = raw as Partial<Backup> | null
  if (!file || typeof file !== 'object' || file.app !== BACKUP_APP || !file.data) {
    throw new BackupFormatError("This file isn't a Lift Log backup.")
  }
  if (typeof file.version !== 'number' || file.version < 1) {
    throw new BackupFormatError('This backup has no version number.')
  }
  if (file.version > SCHEMA_VERSION) {
    throw new BackupFormatError(
      'This backup was made by a newer version of Lift Log. Update the app, then try again.',
    )
  }
  if (typeof file.exportedAt !== 'number') {
    throw new BackupFormatError('This backup has no export date.')
  }

  const data = file.data as unknown as Record<string, unknown>
  for (const [table, shape] of Object.entries(SHAPES)) {
    const rows = data[table]
    if (!Array.isArray(rows)) {
      throw new BackupFormatError(`This backup is missing its ${table} list.`)
    }
    const keyField = table === 'settings' ? 'key' : 'id'
    const seen = new Set<unknown>()
    rows.forEach((row: Record<string, unknown> | null, i) => {
      const bad =
        !row || typeof row !== 'object'
          ? 'row'
          : Object.entries(shape).find(([field, check]) => !matches(row[field], check))?.[0]
      if (bad) {
        throw new BackupFormatError(
          `This backup is damaged: ${table} entry ${i + 1} has a bad ${bad}.`,
        )
      }
      if (seen.has(row![keyField])) {
        throw new BackupFormatError(`This backup is damaged: ${table} has a duplicate entry.`)
      }
      seen.add(row![keyField])
    })
  }

  // Sets and cards must point at records that are in the file.
  const d = file.data
  const exerciseIds = new Set(d.exercises.map((e) => e.id))
  const sessionIds = new Set(d.sessions.map((s) => s.id))
  const cardIds = new Set(d.sessionExercises.map((c) => c.id))
  const orphan =
    d.sessionExercises.some((c) => !sessionIds.has(c.sessionId) || !exerciseIds.has(c.exerciseId)) ||
    d.sets.some(
      (s) =>
        !sessionIds.has(s.sessionId) ||
        !cardIds.has(s.sessionExerciseId) ||
        !exerciseIds.has(s.exerciseId),
    )
  if (orphan) {
    throw new BackupFormatError(
      'This backup is damaged: some sets belong to a workout or exercise that is missing.',
    )
  }
  return file as Backup
}

export interface DataSummary {
  workouts: number
  sets: number
  exercises: number
  customExercises: number
  templates: number
  firstWorkoutAt: number | null
  lastWorkoutAt: number | null
}

export function summarize(data: BackupData): DataSummary {
  const finished = data.sessions.filter((s) => s.endedAt !== null)
  const starts = finished.map((s) => s.startedAt)
  return {
    workouts: finished.length,
    sets: data.sets.filter((s) => s.completed).length,
    exercises: data.exercises.length,
    customExercises: data.exercises.filter((e) => e.isCustom).length,
    templates: data.templates.length,
    firstWorkoutAt: starts.length ? Math.min(...starts) : null,
    lastWorkoutAt: starts.length ? Math.max(...starts) : null,
  }
}

export async function summarizeCurrent(): Promise<DataSummary> {
  return summarize((await exportBackup()).data)
}

/**
 * Replaces everything on this device with the backup, in one transaction: if
 * any part fails, the existing data is left exactly as it was.
 */
export function importBackup(backup: Backup): Promise<void> {
  return db.transaction('rw', ALL_TABLES, async () => {
    await Promise.all(ALL_TABLES.map((t) => t.clear()))
    const d = backup.data
    await db.exercises.bulkAdd(d.exercises)
    await db.templates.bulkAdd(d.templates)
    await db.templateExercises.bulkAdd(d.templateExercises)
    await db.sessions.bulkAdd(d.sessions)
    await db.sessionExercises.bulkAdd(d.sessionExercises)
    await db.sets.bulkAdd(d.sets)
    await db.settings.bulkAdd(d.settings.filter((s) => s.key !== LAST_BACKUP_KEY))
    // The restored data is exactly what that file holds, so it counts as backed up as of then.
    await setLastBackupAt(backup.exportedAt)
  })
}

/** True when there are logged workouts and no backup in the last 7 days. */
export async function isBackupDue(now = Date.now()): Promise<boolean> {
  const last = (await db.settings.get(LAST_BACKUP_KEY))?.value as number | undefined
  if (last !== undefined && now - last <= BACKUP_STALE_MS) return false
  const oldest = await db.sessions.orderBy('startedAt').first()
  if (!oldest) return false
  // Never backed up: give a new install the same 7 days from its first workout.
  return last !== undefined || now - oldest.startedAt > BACKUP_STALE_MS
}

const CSV_COLUMNS = [
  'date',
  'time',
  'workout',
  'exercise',
  'muscle_group',
  'equipment',
  'set',
  'weight',
  'unit',
  'reps',
  'est_1rm',
  'completed_at',
  'workout_notes',
] as const

function csvCell(value: string | number | null): string {
  if (value === null) return ''
  let s = String(value)
  // Stop spreadsheet apps from running a name or note as a formula.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

const pad = (n: number) => String(n).padStart(2, '0')
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/**
 * One row per checked-off set, oldest workout first, in the order the sets
 * appear in the workout. Weights stay in the unit they were entered in.
 */
export async function exportCsv(): Promise<string> {
  const { data } = await exportBackup()
  const exercises = new Map(data.exercises.map((e) => [e.id, e]))
  const templates = new Map(data.templates.map((t) => [t.id, t.name]))
  const cardOrder = new Map(data.sessionExercises.map((c) => [c.id, c.order]))
  const sessions = new Map(data.sessions.map((s) => [s.id, s]))

  const rows = data.sets
    .filter((s) => s.completed)
    .sort((a, b) => {
      const sa = sessions.get(a.sessionId)!
      const sb = sessions.get(b.sessionId)!
      return (
        sa.startedAt - sb.startedAt ||
        (cardOrder.get(a.sessionExerciseId) ?? 0) - (cardOrder.get(b.sessionExerciseId) ?? 0) ||
        a.order - b.order
      )
    })

  const setNumber = new Map<string, number>()
  const lines = [CSV_COLUMNS.join(',')]
  for (const set of rows) {
    const session = sessions.get(set.sessionId)!
    const exercise = exercises.get(set.exerciseId)
    const started = new Date(session.startedAt)
    const n = (setNumber.get(set.sessionExerciseId) ?? 0) + 1
    setNumber.set(set.sessionExerciseId, n)
    const e1rm =
      set.weight !== null && set.reps !== null
        ? Math.round(epley1RM(set.weight, set.reps) * 10) / 10
        : null
    lines.push(
      [
        localDate(started),
        localTime(started),
        (session.templateId && templates.get(session.templateId)) || 'Workout',
        exercise?.name ?? 'Unknown exercise',
        exercise?.muscleGroup ?? '',
        exercise?.equipment ?? '',
        n,
        set.weight,
        set.weight === null ? '' : set.unit,
        set.reps,
        e1rm,
        set.completedAt === null ? null : new Date(set.completedAt).toISOString(),
        session.notes,
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return lines.join('\r\n') + '\r\n'
}
